import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import './TravelMap.css';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom colored icons using divIcon
const createCustomIcon = (color = 'blue', size = 30) => {
  const colorMap = {
    red: '#e74c3c',
    green: '#27ae60',
    blue: '#3498DB',
    orange: '#f39c12',
    purple: '#9b59b6'
  };
  
  const iconColor = colorMap[color] || colorMap.blue;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${iconColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">
      <div style="
        transform: rotate(45deg);
        color: white;
        font-size: ${size * 0.4}px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        font-weight: bold;
      ">📍</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

let DefaultIcon = createCustomIcon();
L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map location updates
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

// Decode Google Maps polyline
const decodePolyline = (encoded) => {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    poly.push([lat * 1e-5, lng * 1e-5]);
  }
  return poly;
};

// Component to draw route
function RouteLine({ route }) {
  if (!route || !route.length) return null;
  
  const polylineOptions = {
    color: '#3498DB',
    weight: 6,
    opacity: 0.9,
    fillOpacity: 0.3,
    lineCap: 'round',
    lineJoin: 'round'
  };

  return <Polyline positions={route} pathOptions={polylineOptions} />;
}

// Component to show turn markers
function TurnMarkers({ steps }) {
  if (!steps || !steps.length) return null;
  
  return (
    <>
      {steps.map((step, index) => {
        if (!step.coordinates || step.coordinates.length !== 2) return null;
        
        return (
          <Marker
            key={`turn-${index}`}
            position={[step.coordinates[0], step.coordinates[1]]}
            icon={createCustomIcon('orange', 25)}
          >
            <Popup>
              <div className="turn-popup">
                <strong>Step {step.step}</strong>
                <p>{step.instruction}</p>
                <p>{step.distance} • {step.duration}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

const TravelMap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef(null);
  const [mapData, setMapData] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([24.8607, 67.0011]); // Default: Karachi
  const [mapZoom, setMapZoom] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMarker, setSearchMarker] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // Directions/Routing states
  const [routeOrigin, setRouteOrigin] = useState('');
  const [routeDestination, setRouteDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Additional features
  const [mapLayer, setMapLayer] = useState('standard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showTransit, setShowTransit] = useState(false);
  const [placesResults, setPlacesResults] = useState([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [mapError, setMapError] = useState(null);
  const destinationFromQuery = searchParams.get('destination') || '';
  const latFromQuery = Number(searchParams.get('lat'));
  const lngFromQuery = Number(searchParams.get('lng'));
  const autoRouteKeyRef = useRef('');
  const backendBaseUrl = (api.defaults.baseURL || '').replace('/api', '');

  const resolveImageUrl = (img) => {
    if (!img) return null;
    if (/^https?:\/\//i.test(img)) return img;
    if (img.startsWith('/')) return `${backendBaseUrl}${img}`;
    return `${backendBaseUrl}/${img}`;
  };

  useEffect(() => {
    fetchMapData();
    getUserLocation();
  }, []);

  const calculateRouteFromCoordinates = async (originCoords, destCoords, originName, destName) => {
    try {
      setCalculatingRoute(true);
      setRoute(null);
      setRouteInfo(null);
      setRouteSteps([]);
      setCurrentStepIndex(0);

      setOriginMarker({
        name: originName,
        coordinates: { lat: originCoords[0], lng: originCoords[1] }
      });
      setDestinationMarker({
        name: destName,
        coordinates: { lat: destCoords[0], lng: destCoords[1] }
      });

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&steps=true`;
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes.length > 0) {
        const routeGeometry = routeData.routes[0].geometry.coordinates;
        const routePath = routeGeometry.map(coord => [coord[1], coord[0]]);
        setRoute(routePath);

        const leg = routeData.routes[0].legs[0];
        const steps = [];
        if (routeData.routes[0].legs?.[0]?.steps) {
          routeData.routes[0].legs[0].steps.forEach((step, index) => {
            const instruction = step.maneuver.type;
            const modifier = step.maneuver.modifier || '';
            let direction = '';
            if (instruction === 'turn' || instruction === 'new name') {
              if (modifier.includes('left')) direction = '⬅️ Turn Left';
              else if (modifier.includes('right')) direction = '➡️ Turn Right';
              else if (modifier.includes('straight')) direction = '⬆️ Go Straight';
              else direction = '⬆️ Continue';
            } else if (instruction === 'depart') direction = '🚀 Start';
            else if (instruction === 'arrive') direction = '🎯 Arrive';
            else direction = '⬆️ Continue';

            steps.push({
              step: index + 1,
              instruction: direction,
              distance: (step.distance / 1000).toFixed(2) + ' km',
              duration: Math.round(step.duration / 60) + ' min',
              name: step.name || 'Road',
              coordinates: step.maneuver?.location
                ? [step.maneuver.location[1], step.maneuver.location[0]]
                : null
            });
          });
        }
        setRouteSteps(steps);
        setRouteInfo({
          distance: (leg.distance / 1000).toFixed(2) + ' km',
          duration: Math.round(leg.duration / 60) + ' minutes',
          distanceValue: leg.distance,
          durationValue: leg.duration
        });

        setMapCenter([
          (originCoords[0] + destCoords[0]) / 2,
          (originCoords[1] + destCoords[1]) / 2
        ]);
        setMapZoom(12);
        setShowDirections(true);
      }
    } catch (error) {
      console.error('Auto route error:', error);
    } finally {
      setCalculatingRoute(false);
    }
  };

  const getCurrentLocationOnce = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve([position.coords.latitude, position.coords.longitude]),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
      );
    });

  const handleQuickRouteToSelectedDestination = async () => {
    if (!destinationMarker?.coordinates) return;

    let originCoords = userLocation;
    let originName = 'Your Location';

    if (!originCoords || originCoords.length !== 2) {
      try {
        const freshLocation = await getCurrentLocationOnce();
        setUserLocation(freshLocation);
        originCoords = freshLocation;
      } catch (error) {
        originCoords = mapCenter;
        originName = 'Map Center';
        setMapError('Location permission unavailable. Route started from map center.');
      }
    }

    setRouteOrigin(originName);
    setRouteDestination(destinationMarker.name || destinationFromQuery || 'Selected Destination');
    calculateRouteFromCoordinates(
      originCoords,
      [destinationMarker.coordinates.lat, destinationMarker.coordinates.lng],
      originName,
      destinationMarker.name || destinationFromQuery || 'Selected Destination'
    );
  };

  useEffect(() => {
    if (!destinationFromQuery || !mapData?.destinations?.length) return;
    const target =
      (Number.isFinite(latFromQuery) && Number.isFinite(lngFromQuery)
        ? { name: destinationFromQuery, coordinates: { lat: latFromQuery, lng: lngFromQuery } }
        : mapData.destinations.find(
            (d) => (d.name || '').toLowerCase() === destinationFromQuery.toLowerCase()
          ));
    if (!target || !target.coordinates) return;

    const routeKey = `${destinationFromQuery}:${target.coordinates.lat},${target.coordinates.lng}`;
    if (autoRouteKeyRef.current === routeKey) return;

    setRouteDestination(target.name);
    setDestinationMarker({
      name: target.name,
      coordinates: { lat: target.coordinates.lat, lng: target.coordinates.lng }
    });
    setMapCenter([target.coordinates.lat, target.coordinates.lng]);
    setMapZoom(12);
    setSelectedMarker(target);
    setShowDirections(true);

    if (userLocation?.length === 2) {
      setRouteOrigin('Your Location');
      calculateRouteFromCoordinates(
        userLocation,
        [target.coordinates.lat, target.coordinates.lng],
        'Your Location',
        target.name
      );
      autoRouteKeyRef.current = routeKey;
    }
  }, [destinationFromQuery, mapData, userLocation, latFromQuery, lngFromQuery]);

  const fetchMapData = async () => {
    try {
      const response = await api.get('/travel-map/data');
      
      // Get data from API response
      const data = response.data || {};
      
      // Filter out destinations without coordinates
      if (data.destinations) {
        data.destinations = data.destinations.filter(dest => dest.coordinates && dest.coordinates.lat && dest.coordinates.lng);
      }
      
      // Filter out hotels without coordinates
      if (data.hotels) {
        data.hotels = data.hotels.filter(hotel => hotel.coordinates && hotel.coordinates.lat && hotel.coordinates.lng);
      }
      
      // Filter out restaurants without coordinates
      if (data.restaurants) {
        data.restaurants = data.restaurants.filter(restaurant => restaurant.coordinates && restaurant.coordinates.lat && restaurant.coordinates.lng);
      }
      
      setMapData(data);
      setLoading(false);
      
      // Set map center to first destination if available
      if (data.destinations && data.destinations.length > 0) {
        const firstDest = data.destinations[0];
        if (firstDest.coordinates) {
          setMapCenter([firstDest.coordinates.lat, firstDest.coordinates.lng]);
          setMapZoom(10);
        }
      }
    } catch (error) {
      console.error('Error fetching map data:', error);
      setMapError(error.response?.data?.message || 'Could not load map data. Showing default location.');
      setMapData({
        destinations: [
          { id: '1', name: 'Karachi', coordinates: { lat: 24.8607, lng: 67.0011 }, type: 'destination' }
        ],
        hotels: [],
        restaurants: []
      });
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          // Auto-center if no destinations
          if (!mapData?.destinations?.length) {
            setMapCenter(loc);
            setMapZoom(14);
          }
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  };

  const handleLocationClick = () => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(14);
    } else {
      getUserLocation();
    }
  };

  // Search function - uses Google Maps Geocoding API if available, otherwise OpenStreetMap Nominatim
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    const googleMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

    try {
      let data, coordinates, name, address;

      // Try Google Maps Geocoding API first if key is available
      if (googleMapsKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${googleMapsKey}`
          );
          const googleData = await response.json();

          if (googleData.status === 'OK' && googleData.results.length > 0) {
            const result = googleData.results[0];
            coordinates = [
              result.geometry.location.lat,
              result.geometry.location.lng
            ];
            name = result.formatted_address;
            address = result.address_components;
            
            setSearchMarker({
              name: name,
              coordinates: { lat: coordinates[0], lng: coordinates[1] },
              type: 'searched',
              icon: '🔍',
              address: address
            });

            setMapCenter(coordinates);
            setMapZoom(14);
            setSearching(false);
            return;
          }
        } catch (googleError) {
          console.log('Google Maps API error, falling back to OpenStreetMap:', googleError);
        }
      }

      // Fallback to OpenStreetMap Nominatim API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      data = await response.json();

      if (data && data.length > 0) {
        const firstResult = data[0];
        coordinates = [parseFloat(firstResult.lat), parseFloat(firstResult.lon)];
        
        setSearchMarker({
          name: firstResult.display_name,
          coordinates: { lat: coordinates[0], lng: coordinates[1] },
          type: 'searched',
          icon: '🔍',
          address: firstResult.address
        });

        setMapCenter(coordinates);
        setMapZoom(13);
        setSearchResults(data);
        setSelectedMarker(null);
      } else {
        setSearchError('Location not found. Please try a different search term.');
        setSearchMarker(null);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Error searching location. Please try again.');
      setSearchMarker(null);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchMarker(null);
    setSearchError(null);
  };

  // Calculate route - uses Google Maps Directions API if available, otherwise OSRM
  const calculateRoute = async () => {
    if (!routeOrigin.trim() || !routeDestination.trim()) {
      alert('Please enter both origin and destination');
      return;
    }

    setCalculatingRoute(true);
    setRoute(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setOriginMarker(null);
    setDestinationMarker(null);
    setCurrentStepIndex(0);

    const googleMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

    try {
      let originCoords, destCoords, originName, destName;

      // Geocode using Google Maps API if available
      if (googleMapsKey) {
        try {
          // Geocode origin
          const originRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(routeOrigin)}&key=${googleMapsKey}`
          );
          const originData = await originRes.json();

          // Geocode destination
          const destRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(routeDestination)}&key=${googleMapsKey}`
          );
          const destData = await destRes.json();

          if (originData.status === 'OK' && destData.status === 'OK' && 
              originData.results.length > 0 && destData.results.length > 0) {
            originCoords = [
              originData.results[0].geometry.location.lat,
              originData.results[0].geometry.location.lng
            ];
            destCoords = [
              destData.results[0].geometry.location.lat,
              destData.results[0].geometry.location.lng
            ];
            originName = originData.results[0].formatted_address;
            destName = destData.results[0].formatted_address;

            // Get route from Google Maps Directions API
            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords[0]},${originCoords[1]}&destination=${destCoords[0]},${destCoords[1]}&key=${googleMapsKey}&alternatives=false`;
            const directionsRes = await fetch(directionsUrl);
            const directionsData = await directionsRes.json();

            if (directionsData.status === 'OK' && directionsData.routes.length > 0) {
              const route = directionsData.routes[0];
              const leg = route.legs[0];

              // Decode polyline
              const decodedPath = decodePolyline(route.overview_polyline.points);
              setRoute(decodedPath);

              // Set markers
              setOriginMarker({
                name: originName,
                coordinates: { lat: originCoords[0], lng: originCoords[1] }
              });

              setDestinationMarker({
                name: destName,
                coordinates: { lat: destCoords[0], lng: destCoords[1] }
              });

              // Extract turn-by-turn directions
              const steps = [];
              let stepNumber = 1;
              
              leg.steps.forEach((step) => {
                const instruction = step.html_instructions
                  .replace(/<[^>]*>/g, '') // Remove HTML tags
                  .replace(/&nbsp;/g, ' ')
                  .trim();
                
                const maneuver = step.maneuver || '';
                let directionIcon = '➡️';
                
                if (maneuver.includes('left') || instruction.toLowerCase().includes('left')) {
                  directionIcon = '⬅️';
                } else if (maneuver.includes('right') || instruction.toLowerCase().includes('right')) {
                  directionIcon = '➡️';
                } else if (maneuver.includes('straight') || instruction.toLowerCase().includes('straight')) {
                  directionIcon = '⬆️';
                } else if (maneuver.includes('slight-left')) {
                  directionIcon = '↖️';
                } else if (maneuver.includes('slight-right')) {
                  directionIcon = '↗️';
                } else if (maneuver.includes('sharp-left')) {
                  directionIcon = '↙️';
                } else if (maneuver.includes('sharp-right')) {
                  directionIcon = '↘️';
                }

                steps.push({
                  step: stepNumber++,
                  instruction: `${directionIcon} ${instruction}`,
                  distance: step.distance.text,
                  duration: step.duration.text,
                  name: step.html_instructions.match(/<b>([^<]+)<\/b>/)?.[1] || 'Road',
                  coordinates: [
                    step.end_location.lat,
                    step.end_location.lng
                  ]
                });
              });

              setRouteSteps(steps);
              setRouteInfo({
                distance: leg.distance.text,
                duration: leg.duration.text,
                distanceValue: leg.distance.value,
                durationValue: leg.duration.value
              });

              // Center map on route
              const bounds = [
                [Math.min(originCoords[0], destCoords[0]), Math.min(originCoords[1], destCoords[1])],
                [Math.max(originCoords[0], destCoords[0]), Math.max(originCoords[1], destCoords[1])]
              ];
              setMapCenter([
                (originCoords[0] + destCoords[0]) / 2,
                (originCoords[1] + destCoords[1]) / 2
              ]);
              setMapZoom(12);

              setCalculatingRoute(false);
              setShowDirections(true);
              return;
            }
          }
        } catch (googleError) {
          console.log('Google Maps API error, falling back to OSRM:', googleError);
        }
      }

      // Fallback to OpenStreetMap Nominatim + OSRM
      const originRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(routeOrigin)}&limit=1`
      );
      const originData = await originRes.json();

      const destRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(routeDestination)}&limit=1`
      );
      const destData = await destRes.json();

      if (!originData.length || !destData.length) {
        alert('Could not find one or both locations. Please try different search terms.');
        setCalculatingRoute(false);
        return;
      }

      originCoords = [parseFloat(originData[0].lat), parseFloat(originData[0].lon)];
      destCoords = [parseFloat(destData[0].lat), parseFloat(destData[0].lon)];
      originName = originData[0].display_name;
      destName = destData[0].display_name;

      setOriginMarker({
        name: originName,
        coordinates: { lat: originCoords[0], lng: originCoords[1] }
      });

      setDestinationMarker({
        name: destName,
        coordinates: { lat: destCoords[0], lng: destCoords[1] }
      });

      // Get route from OSRM with steps
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&steps=true`;
      
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes.length > 0) {
        const routeGeometry = routeData.routes[0].geometry.coordinates;
        const routePath = routeGeometry.map(coord => [coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
        
        setRoute(routePath);
        
        const leg = routeData.routes[0].legs[0];
        
        // Extract turn-by-turn directions
        const steps = [];
        if (routeData.routes[0].legs && routeData.routes[0].legs[0].steps) {
          routeData.routes[0].legs[0].steps.forEach((step, index) => {
            const instruction = step.maneuver.type;
            const modifier = step.maneuver.modifier || '';
            let direction = '';
            
            // Convert OSRM instructions to readable format
            if (instruction === 'turn' || instruction === 'new name') {
              if (modifier.includes('left')) direction = '⬅️ Turn Left';
              else if (modifier.includes('right')) direction = '➡️ Turn Right';
              else if (modifier.includes('straight')) direction = '⬆️ Go Straight';
              else if (modifier.includes('slight left')) direction = '↖️ Slight Left';
              else if (modifier.includes('slight right')) direction = '↗️ Slight Right';
              else if (modifier.includes('sharp left')) direction = '↙️ Sharp Left';
              else if (modifier.includes('sharp right')) direction = '↘️ Sharp Right';
              else direction = '⬆️ Continue';
            } else if (instruction === 'depart') {
              direction = '🚀 Start';
            } else if (instruction === 'arrive') {
              direction = '🎯 Arrive';
            } else {
              direction = '⬆️ Continue';
            }
            
            steps.push({
              step: index + 1,
              instruction: direction,
              distance: (step.distance / 1000).toFixed(2) + ' km',
              duration: Math.round(step.duration / 60) + ' min',
              name: step.name || 'Road',
              coordinates: step.maneuver && step.maneuver.location 
                ? [step.maneuver.location[1], step.maneuver.location[0]]
                : null
            });
          });
        }
        
        setRouteSteps(steps);
        setRouteInfo({
          distance: (leg.distance / 1000).toFixed(2) + ' km',
          duration: Math.round(leg.duration / 60) + ' minutes',
          distanceValue: leg.distance,
          durationValue: leg.duration
        });

        // Center map on route
        setMapCenter([
          (originCoords[0] + destCoords[0]) / 2,
          (originCoords[1] + destCoords[1]) / 2
        ]);
        setMapZoom(12);
        setShowDirections(true);
      } else {
        alert('Could not calculate route. Please try different locations.');
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      alert('Error calculating route. Please try again.');
    } finally {
      setCalculatingRoute(false);
    }
  };

  const clearRoute = () => {
    setRoute(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setRouteOrigin('');
    setRouteDestination('');
    setOriginMarker(null);
    setDestinationMarker(null);
    setVoiceEnabled(false);
    setCurrentStepIndex(0);
  };

  // Voice navigation
  const speakDirection = (text) => {
    if ('speechSynthesis' in window && voiceEnabled) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled && routeSteps.length > 0) {
      speakDirection(`Starting navigation. ${routeSteps[0].instruction} for ${routeSteps[0].distance}`);
    }
  };

  const playStep = (stepIndex) => {
    if (routeSteps[stepIndex]) {
      const step = routeSteps[stepIndex];
      const text = `Step ${step.step}. ${step.instruction} on ${step.name} for ${step.distance}`;
      speakDirection(text);
      setCurrentStepIndex(stepIndex);
      
      // Center map on step location
      if (step.coordinates) {
        setMapCenter(step.coordinates);
        setMapZoom(15);
      }
    }
  };

  // Set origin/destination from marker click
  const setAsOrigin = (marker) => {
    if (marker.coordinates) {
      setRouteOrigin(marker.name || `${marker.coordinates.lat}, ${marker.coordinates.lng}`);
      if (searchMarker && searchMarker.name === marker.name) {
        setRouteOrigin(searchMarker.name);
      }
    }
  };

  const setAsDestination = (marker) => {
    if (marker.coordinates) {
      setRouteDestination(marker.name || `${marker.coordinates.lat}, ${marker.coordinates.lng}`);
      if (searchMarker && searchMarker.name === marker.name) {
        setRouteDestination(searchMarker.name);
      }
    }
  };

  // Share location
  const shareLocation = (marker) => {
    if (marker.coordinates && navigator.share) {
      const url = `https://www.google.com/maps?q=${marker.coordinates.lat},${marker.coordinates.lng}`;
      navigator.share({
        title: marker.name,
        text: `Check out this location: ${marker.name}`,
        url: url
      });
    } else {
      // Fallback: copy to clipboard
      const url = `https://www.google.com/maps?q=${marker.coordinates.lat},${marker.coordinates.lng}`;
      navigator.clipboard.writeText(url);
      alert('Location link copied to clipboard!');
    }
  };

  // Print map
  const printMap = () => {
    window.print();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Search places using Google Places API
  const searchPlaces = async (query) => {
    const googleMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey || !query.trim()) return;

    setSearchingPlaces(true);
    try {
      // Use Places API Text Search
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleMapsKey}&location=${mapCenter[0]},${mapCenter[1]}&radius=50000`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const places = data.results.map(place => ({
          name: place.name,
          address: place.formatted_address,
          coordinates: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          rating: place.rating,
          types: place.types,
          placeId: place.place_id
        }));
        setPlacesResults(places);
      }
    } catch (error) {
      console.error('Places search error:', error);
    } finally {
      setSearchingPlaces(false);
    }
  };

  // Get tile layer URL based on selection
  const getTileLayerUrl = () => {
    const googleMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    switch (mapLayer) {
      case 'google-satellite':
        if (googleMapsKey) {
          return `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
        }
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'google-roadmap':
        if (googleMapsKey) {
          return `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
        }
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'google-terrain':
        if (googleMapsKey) {
          return `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
        }
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'google-hybrid':
        if (googleMapsKey) {
          return `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
        }
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'light':
        return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      default:
        if (googleMapsKey) {
          return `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
        }
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  // Get traffic layer URL (Google Maps only)
  const getTrafficLayerUrl = () => {
    const googleMapsKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (googleMapsKey && showTraffic) {
      return `https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}&key=${googleMapsKey}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="travel-map">
        <div className="header">
          <h1>Travel Map</h1>
        </div>
        <div className="content">
          <div className="map-placeholder">Loading map data...</div>
        </div>
      </div>
    );
  }

  // Combine all markers
  const allMarkers = [
    ...(mapData?.destinations || []).map(d => ({
      ...d,
      type: 'destination',
      icon: '📍'
    })),
    ...(mapData?.hotels || []).map(h => ({
      ...h,
      type: 'hotel',
      icon: '🏨'
    })),
    ...(mapData?.restaurants || []).map(r => ({
      ...r,
      type: 'restaurant',
      icon: '🍽️'
    }))
  ];

  return (
    <div className={`travel-map ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="header">
        <h1>Travel Map</h1>
        <div className="header-actions">
          {userLocation && (
            <button onClick={handleLocationClick} className="location-btn btn-secondary">
              My Location
            </button>
          )}
          <button onClick={toggleFullscreen} className="fullscreen-btn btn-secondary">
            {isFullscreen ? '🗗 Exit Fullscreen' : '🗖 Fullscreen'}
          </button>
          <button onClick={printMap} className="print-btn btn-secondary">
            🖨️ Print
          </button>
        </div>
      </div>
      {mapError && (
        <div className="page-error-banner">
          <span>{mapError}</span>
          <button type="button" onClick={() => { setMapError(null); fetchMapData(); }}>Retry</button>
        </div>
      )}

      <div className="content">
        {/* Search Section */}
        <div className="map-search-section">
          <div className="search-header">
            <h3>🔍 Search Location</h3>
            <button 
              onClick={() => setShowDirections(!showDirections)} 
              className="toggle-directions-btn btn-primary"
            >
              {showDirections ? '📍 Hide Directions' : '🧭 Show Directions'}
            </button>
          </div>
          
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Search for a city, place, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                disabled={searching}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="clear-search-btn"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <button 
              type="submit" 
              className="search-btn btn-primary"
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? '⏳ Searching...' : '🔍 Search'}
            </button>
          </form>
          
          {searchError && (
            <div className="search-error">
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="search-results">
              <h4>Search Results</h4>
              <div className="results-list">
                {searchResults.slice(0, 3).map((result, index) => (
                  <div
                    key={index}
                    className="result-item"
                    onClick={() => {
                      const coords = [parseFloat(result.lat), parseFloat(result.lon)];
                      setMapCenter(coords);
                      setMapZoom(13);
                      setSearchMarker({
                        name: result.display_name,
                        coordinates: { lat: coords[0], lng: coords[1] },
                        type: 'searched',
                        icon: '🔍',
                        address: result.address
                      });
                    }}
                  >
                    <span className="result-icon">📍</span>
                    <div className="result-details">
                      <strong>{result.display_name}</strong>
                      <span className="result-type">{result.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Directions Panel */}
          {showDirections && (
            <div className="directions-panel">
              <h4>🧭 Get Directions</h4>
              <div className="directions-inputs">
                <div className="direction-input-group">
                  <label>📍 Origin</label>
                  <input
                    type="text"
                    placeholder="Starting point..."
                    value={routeOrigin}
                    onChange={(e) => setRouteOrigin(e.target.value)}
                    className="direction-input"
                  />
                </div>
                <div className="direction-input-group">
                  <label>🎯 Destination</label>
                  <input
                    type="text"
                    placeholder="Destination..."
                    value={routeDestination}
                    onChange={(e) => setRouteDestination(e.target.value)}
                    className="direction-input"
                  />
                </div>
              </div>
              <div className="directions-actions">
                <button 
                  onClick={calculateRoute} 
                  className="btn-primary"
                  disabled={calculatingRoute || !routeOrigin.trim() || !routeDestination.trim()}
                >
                  {calculatingRoute ? '⏳ Calculating...' : '🧭 Get Route'}
                </button>
                {!!destinationFromQuery && !userLocation && (
                  <button
                    type="button"
                    onClick={handleQuickRouteToSelectedDestination}
                    className="btn-secondary"
                    disabled={calculatingRoute || !destinationMarker?.coordinates}
                  >
                    📍 Quick Route
                  </button>
                )}
                {route && (
                  <button onClick={clearRoute} className="btn-danger">
                    Clear Route
                  </button>
                )}
              </div>
              {routeInfo && (
                <div className="route-info">
                  <div className="route-stat">
                    <span><strong>Distance:</strong> {routeInfo.distance}</span>
                  </div>
                  <div className="route-stat">
                    <span><strong>Duration:</strong> {routeInfo.duration}</span>
                  </div>
                  <div className="route-stat">
                    <span><strong>Steps:</strong> {routeInfo.steps || 0}</span>
                  </div>
                  <button 
                    onClick={toggleVoice} 
                    className={`voice-btn ${voiceEnabled ? 'active' : ''}`}
                  >
                    {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
                  </button>
                </div>
              )}
              
              {routeSteps.length > 0 && (
                <div className="route-steps">
                  <h4>🧭 Turn-by-Turn Directions</h4>
                  <div className="steps-list">
                    {routeSteps.map((step, index) => (
                      <div 
                        key={index}
                        className={`step-item ${index === currentStepIndex ? 'active' : ''}`}
                        onClick={() => playStep(index)}
                      >
                        <div className="step-number">{step.step}</div>
                        <div className="step-content">
                          <div className="step-instruction">{step.instruction}</div>
                          <div className="step-details">
                            <span>{step.name}</span>
                            <span className="step-distance">{step.distance} • {step.duration}</span>
                          </div>
                        </div>
                        {voiceEnabled && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              playStep(index);
                            }}
                            className="play-step-btn"
                            title="Play voice instruction"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map Controls - Google Maps Style */}
        <div className="map-controls-panel">
          <div className="map-layer-selector">
            <label>🗺️ Map Style</label>
            <select value={mapLayer} onChange={(e) => setMapLayer(e.target.value)} className="layer-select">
              <option value="standard">Standard (OpenStreetMap)</option>
              {process.env.REACT_APP_GOOGLE_MAPS_API_KEY && (
                <>
                  <option value="google-roadmap">Google Roadmap</option>
                  <option value="google-satellite">Google Satellite</option>
                  <option value="google-terrain">Google Terrain</option>
                  <option value="google-hybrid">Google Hybrid</option>
                </>
              )}
              <option value="satellite">Satellite (ArcGIS)</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          {process.env.REACT_APP_GOOGLE_MAPS_API_KEY && (
            <div className="map-layers-toggle">
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={showTraffic}
                  onChange={(e) => setShowTraffic(e.target.checked)}
                />
                <span>🚦 Traffic</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={showTransit}
                  onChange={(e) => setShowTransit(e.target.checked)}
                />
                <span>🚇 Transit</span>
              </label>
            </div>
          )}

          <div className="places-search-section">
            <label>🔍 Search Places</label>
            <div className="places-search-input">
              <input
                type="text"
                placeholder="Search nearby places (restaurants, hotels, etc.)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchPlaces(e.target.value);
                  }
                }}
                className="places-input"
              />
              <button
                onClick={() => {
                  const input = document.querySelector('.places-input');
                  if (input) searchPlaces(input.value);
                }}
                className="places-search-btn"
                disabled={searchingPlaces}
              >
                {searchingPlaces ? '⏳' : '🔍'}
              </button>
            </div>
            {placesResults.length > 0 && (
              <div className="places-results">
                {placesResults.slice(0, 5).map((place, idx) => (
                  <div
                    key={idx}
                    className="place-result-item"
                    onClick={() => {
                      setMapCenter([place.coordinates.lat, place.coordinates.lng]);
                      setMapZoom(15);
                      setSearchMarker({
                        name: place.name,
                        coordinates: place.coordinates,
                        type: 'place',
                        icon: '📍'
                      });
                    }}
                  >
                    <div className="place-name">{place.name}</div>
                    <div className="place-address">{place.address}</div>
                    {place.rating && (
                      <div className="place-rating">⭐ {place.rating}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="map-controls">
          <div className="map-info">
            <h3>📍 Map Features</h3>
            <div className="info-stats">
              <span>📍 {mapData?.destinations?.length || 0} Destinations</span>
              <span>🏨 {mapData?.hotels?.length || 0} Hotels</span>
              <span>🍽️ {mapData?.restaurants?.length || 0} Restaurants</span>
              {searchMarker && <span>🔍 1 Searched</span>}
              {route && <span>🧭 Route Active</span>}
            </div>
          </div>
        </div>

        <div className="map-wrapper" ref={mapRef}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '600px', width: '100%', borderRadius: '15px', zIndex: 1 }}
            scrollWheelZoom={true}
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;
            }}
          >
            <TileLayer
              key={mapLayer}
              attribution={
                mapLayer.startsWith('google') 
                  ? '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              }
              url={getTileLayerUrl()}
            />
            
            {/* Traffic Layer Overlay (Google Maps only) */}
            {showTraffic && process.env.REACT_APP_GOOGLE_MAPS_API_KEY && mapLayer.startsWith('google') && (
              <TileLayer
                key="traffic-layer"
                url={`https://mt1.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`}
                opacity={0.6}
                zIndex={200}
                attribution=""
              />
            )}
            
            {/* Transit Layer Overlay (Google Maps only) */}
            {showTransit && process.env.REACT_APP_GOOGLE_MAPS_API_KEY && mapLayer.startsWith('google') && (
              <TileLayer
                key="transit-layer"
                url={`https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`}
                opacity={0.4}
                zIndex={150}
                attribution=""
              />
            )}
            
            <MapUpdater center={mapCenter} zoom={mapZoom} />

            {/* Route Line */}
            <RouteLine route={route} />
            
            {/* Turn Markers */}
            <TurnMarkers steps={routeSteps} />

            {/* User Location Marker */}
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={10}
                pathOptions={{ color: '#27ae60', fillColor: '#27ae60', fillOpacity: 0.6 }}
              >
                <Popup>
                  <strong>You are here</strong>
                </Popup>
              </CircleMarker>
            )}

            {/* Origin Marker */}
            {originMarker && originMarker.coordinates && (
              <Marker 
                position={[originMarker.coordinates.lat, originMarker.coordinates.lng]}
                icon={createCustomIcon('green', [30, 45])}
              >
                <Popup>
                  <div className="marker-popup">
                    <h4>Origin: {originMarker.name}</h4>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination Marker */}
            {destinationMarker && destinationMarker.coordinates && (
              <Marker 
                position={[destinationMarker.coordinates.lat, destinationMarker.coordinates.lng]}
                icon={createCustomIcon('red', [30, 45])}
              >
                <Popup>
                  <div className="marker-popup">
                    <h4>Destination: {destinationMarker.name}</h4>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Search Result Marker */}
            {searchMarker && searchMarker.coordinates && (
              <Marker 
                position={[searchMarker.coordinates.lat, searchMarker.coordinates.lng]}
                icon={createCustomIcon('blue', [30, 45])}
              >
                  <Popup>
                    <div className="marker-popup">
                      <h4>{searchMarker.name}</h4>
                      <p><strong>Type:</strong> Searched Location</p>
                      {searchMarker.coordinates && (
                        <p className="coordinates">
                          📍 {searchMarker.coordinates.lat.toFixed(4)}, {searchMarker.coordinates.lng.toFixed(4)}
                        </p>
                      )}
                      <div className="popup-actions">
                        <button onClick={() => setAsOrigin(searchMarker)} className="popup-btn">📍 Origin</button>
                        <button onClick={() => setAsDestination(searchMarker)} className="popup-btn">🎯 Destination</button>
                        <a
                          href={`https://www.google.com/maps?q=${searchMarker.coordinates.lat},${searchMarker.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="popup-btn"
                        >
                          🗺️ Open in Google Maps
                        </a>
                        <a
                          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${searchMarker.coordinates.lat},${searchMarker.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="popup-btn"
                        >
                          🚶 Street View
                        </a>
                        <button onClick={() => shareLocation(searchMarker)} className="popup-btn">📤 Share</button>
                      </div>
                    </div>
                  </Popup>
              </Marker>
            )}

            {/* Destination Markers */}
            {allMarkers.map((marker, index) => {
              if (!marker.coordinates || !marker.coordinates.lat) return null;
              
              return (
                <Marker
                  key={index}
                  position={[marker.coordinates.lat, marker.coordinates.lng]}
                  eventHandlers={{
                    click: () => setSelectedMarker(marker)
                  }}
                >
                  <Popup>
                    <div className="marker-popup">
                      <h4>{marker.name}</h4>
                      <p><strong>Type:</strong> {marker.type}</p>
                    {marker.image && (
                      <img
                        src={resolveImageUrl(marker.image)}
                        alt={marker.name}
                        style={{
                          width: '100%',
                          maxWidth: '220px',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          margin: '6px 0 8px'
                        }}
                      />
                    )}
                      {marker.coordinates && (
                        <>
                          <p className="coordinates">
                            📍 {marker.coordinates.lat.toFixed(4)}, {marker.coordinates.lng.toFixed(4)}
                          </p>
                          <div className="popup-actions">
                            <button onClick={() => setAsOrigin(marker)} className="popup-btn">📍 Origin</button>
                            <button onClick={() => setAsDestination(marker)} className="popup-btn">🎯 Destination</button>
                            <a
                              href={`https://www.google.com/maps?q=${marker.coordinates.lat},${marker.coordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="popup-btn"
                            >
                              🗺️ Google Maps
                            </a>
                            <a
                              href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${marker.coordinates.lat},${marker.coordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="popup-btn"
                            >
                              🚶 Street View
                            </a>
                            <button onClick={() => shareLocation(marker)} className="popup-btn">📤 Share</button>
                          </div>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="map-legend">
          <h3>🗺️ Map Legend</h3>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-icon">📍</span>
              <span>Destinations</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon">🏨</span>
              <span>Hotels</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon">🍽️</span>
              <span>Restaurants</span>
            </div>
            {userLocation && (
              <div className="legend-item">
                <span className="legend-icon" style={{color: '#27ae60'}}>●</span>
                <span>Your Location</span>
              </div>
            )}
            {searchMarker && (
              <div className="legend-item">
                <span className="legend-icon">🔍</span>
                <span>Searched</span>
              </div>
            )}
            {route && (
              <>
                <div className="legend-item">
                  <span className="legend-icon" style={{color: '#27ae60'}}>📍</span>
                  <span>Origin</span>
                </div>
                <div className="legend-item">
                  <span className="legend-icon" style={{color: '#e74c3c'}}>🎯</span>
                  <span>Destination</span>
                </div>
                <div className="legend-item">
                  <span className="legend-icon" style={{color: '#3498DB'}}>━</span>
                  <span>Route</span>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedMarker && (
          <div className="selected-marker-info">
            <h3>{selectedMarker.name}</h3>
            <p><strong>Type:</strong> {selectedMarker.type}</p>
            {selectedMarker.image && (
              <img
                src={resolveImageUrl(selectedMarker.image)}
                alt={selectedMarker.name}
                style={{
                  width: '100%',
                  maxWidth: '280px',
                  height: '140px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  marginBottom: '10px'
                }}
              />
            )}
            {selectedMarker.coordinates && (
              <p><strong>Coordinates:</strong> {selectedMarker.coordinates.lat.toFixed(4)}, {selectedMarker.coordinates.lng.toFixed(4)}</p>
            )}
            <div className="marker-actions">
              <button onClick={() => setAsOrigin(selectedMarker)} className="btn-primary">Set as Origin</button>
              <button onClick={() => setAsDestination(selectedMarker)} className="btn-secondary">Set as Destination</button>
              <button onClick={() => shareLocation(selectedMarker)} className="btn-secondary">Share Location</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TravelMap;
