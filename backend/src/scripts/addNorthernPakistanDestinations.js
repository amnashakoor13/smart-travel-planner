/**
 * Northern / hilly / valley Pakistan destinations (curated list).
 * Images: Unsplash CDN; each set ties to Pakistan listings on the photo page
 * (exact place, or same valley/route — e.g. Phander/Ghizer highlands for Shandur when Shandur itself has no free hits).
 * Upserts by destination name (case-insensitive).
 *
 * Usage: node backend/src/scripts/addNorthernPakistanDestinations.js
 */

const mongoose = require('mongoose');
const Destination = require('../models/Destination');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-travel-planner', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB Connected');
  addDestinations();
}).catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Unsplash CDN — w=1200&q=80 for consistent sizing */
const U = (id) => `https://images.unsplash.com/${id}?w=1200&q=80`;

async function addDestinations() {
  try {
    console.log('🔄 Upserting Northern Pakistan destinations...\n');

    const destinations = [
      // 🏔️ Northern Areas
      {
        name: 'Passu and Passu Cones',
        city: 'Passu',
        country: 'Pakistan',
        region: 'Northern Areas',
        category: 'Northern Areas',
        description: 'Karakoram village famous for Passu Cones, glacier lookouts, and the road toward Khunjerab. Core stop in upper Gojal.',
        coordinates: { lat: 36.4189, lng: 74.8619 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1684230715200-40f32e068bf2'),
          U('photo-1592859394443-5b9679d830c1'),
          U('photo-1722082933604-288a1c130475')
        ]
      },
      {
        name: 'Shandur Pass',
        city: 'Shandur',
        country: 'Pakistan',
        region: 'Gilgit-Baltistan',
        category: 'Northern Areas',
        description: 'High pass between Ghizer/Chitral known for Shandur Polo Festival and alpine Shandur Lake. Summer access only.',
        coordinates: { lat: 36.3575, lng: 72.5469 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1675410240817-6db8cb6efbb8'),
          U('photo-1675410248124-922b8d58d8bc'),
          U('photo-1675410220197-2e1f32aa125a')
        ]
      },
      {
        name: 'Fairy Meadows',
        city: 'Fairy Meadows',
        country: 'Pakistan',
        region: 'Northern Areas',
        category: 'Northern Areas',
        description: 'Meadow camp facing Nanga Parbat. Famous trekking route (jeep track + hike), camping, and sunrise views.',
        coordinates: { lat: 35.3667, lng: 74.5833 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1664872759149-b7605ca5a3a7'),
          U('photo-1653163517210-2e3b56190680'),
          U('photo-1664872749442-01507d1f1c6e')
        ]
      },
      {
        name: 'Skardu',
        city: 'Skardu',
        country: 'Pakistan',
        region: 'Northern Areas',
        category: 'Northern Areas',
        description: 'Gateway to Baltistan — K2 base camp routes, cold-desert landscapes, and lakes like Shangrila and Kachura.',
        coordinates: { lat: 35.2971, lng: 75.6333 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1627670476256-d333ee59da11'),
          U('photo-1695724426547-c695ce34c358'),
          U('photo-1627670478406-39661a3756a9')
        ]
      },

      // 🌿 Valleys — Neelum / Swat
      {
        name: 'Arang Kel',
        city: 'Kel',
        country: 'Pakistan',
        region: 'Azad Kashmir',
        category: 'Valleys',
        description: 'Meadow village above Kel in Neelum Valley — chairlift or hike from Kel, pine forests and ridge views.',
        coordinates: { lat: 34.8564, lng: 74.3614 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1728137490905-281e8c23712f'),
          U('photo-1727510488646-8736e1725f7a'),
          U('photo-1659553761498-6a8728fbf281')
        ]
      },
      {
        name: 'Keran',
        city: 'Keran',
        country: 'Pakistan',
        region: 'Azad Kashmir',
        category: 'Valleys',
        description: 'Neelum Valley riverside town — Line of Sight across the river, guesthouses, and base for upstream trips.',
        coordinates: { lat: 34.7919, lng: 73.9019 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1727510488571-15f393ece856'),
          U('photo-1657953879390-5dcde2cb4205'),
          U('photo-1728137490905-281e8c23712f')
        ]
      },
      {
        name: 'Sharda',
        city: 'Sharda',
        country: 'Pakistan',
        region: 'Azad Kashmir',
        category: 'Valleys',
        description: 'Historic Neelum Valley settlement — Sharda temple ruins, river beaches, and jump-off for Kel and upper valley.',
        coordinates: { lat: 34.7983, lng: 74.1894 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1432405972618-132789239eca'),
          U('photo-1501785888042-cc850ee91'),
          U('photo-1447752875215-b2761acb3c5d')
        ]
      },
      {
        name: 'Taobat',
        city: 'Taobat',
        country: 'Pakistan',
        region: 'Azad Kashmir',
        category: 'Valleys',
        description: 'Last sizeable village in Neelum near the line of control — remote scenery, clear streams, multi-day road from Muzaffarabad.',
        coordinates: { lat: 34.6694, lng: 74.0528 },
        isPopular: false,
        bestSeason: 'summer',
        images: [
          U('photo-1728137597529-56116895b9b5'),
          U('photo-1687286945285-c0fa4b0753ae'),
          U('photo-1659553761498-6a8728fbf281')
        ]
      },
      {
        name: 'Kalam Valley',
        city: 'Kalam',
        country: 'Pakistan',
        region: 'Khyber Pakhtunkhwa',
        category: 'Valleys',
        description: 'Upper Swat — Ushu, Mahodand road, riverside walks. Pair with Malam Jabba for a full Swat loop.',
        coordinates: { lat: 35.4833, lng: 72.5833 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1649279585660-b29ab13b93a8'),
          U('photo-1644491678354-b5d417ab47c8'),
          U('photo-1724142923909-fc4b0c3a2a32')
        ]
      },

      // 🌄 Hill stations
      {
        name: 'Murree',
        city: 'Murree',
        country: 'Pakistan',
        region: 'Punjab',
        category: 'Hill Stations',
        description: 'Classic weekend hill station from Islamabad — Mall Road, Pindi Point, winter fog and summer crowds.',
        coordinates: { lat: 33.9078, lng: 73.3903 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1448375232540-44afc0de9585'),
          U('photo-1504608524841-42fe6f032b4b'),
          U('photo-1472214103451-9374bd1c798e')
        ]
      },
      {
        name: 'Nathia Gali',
        city: 'Nathia Gali',
        country: 'Pakistan',
        region: 'Khyber Pakhtunkhwa',
        category: 'Hill Stations',
        description: 'Galiyat pine forests, hiking to Mukshpuri, cooler summers than the plains.',
        coordinates: { lat: 34.0167, lng: 73.3833 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1682465343121-d9053cc7c755'),
          U('photo-1682465343177-e2ebe41334ce'),
          U('photo-1675766305870-970dfa85f57d')
        ]
      },
      {
        name: 'Malam Jabba',
        city: 'Malam Jabba',
        country: 'Pakistan',
        region: 'Khyber Pakhtunkhwa',
        category: 'Hill Stations',
        description: 'Ski and resort area above Swat — chairlift, hikes, and winter sports.',
        coordinates: { lat: 35.2167, lng: 72.5500 },
        isPopular: true,
        bestSeason: 'winter',
        images: [
          U('photo-1602046853144-314eb7bddd7b'),
          U('photo-1615108625383-3b9f00d0ad77'),
          U('photo-1609502800664-b092de52c7bb')
        ]
      },

      // 🏞️ Lakes
      {
        name: 'Saif-ul-Malook Lake',
        city: 'Naran',
        country: 'Pakistan',
        region: 'Khyber Pakhtunkhwa',
        category: 'Lakes',
        description: 'High-altitude lake above Naran — jeep track, boating season, iconic mountain backdrop.',
        coordinates: { lat: 34.8833, lng: 73.7000 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1626685516371-a0ee93a0f370'),
          U('photo-1694327454162-bd320f1538fd'),
          U('photo-1606815455082-ad72381c8b41')
        ]
      },
      {
        name: 'Attabad Lake',
        city: 'Gojal',
        country: 'Pakistan',
        region: 'Northern Areas',
        category: 'Lakes',
        description: 'Turquoise landslide lake on the Karakoram Highway — boat rides, dramatic cliffs, link between Hunza and upper valleys.',
        coordinates: { lat: 36.3167, lng: 74.8333 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1611821887389-cd0ae7ebfff4'),
          U('photo-1684230715186-cb6387f1f09f'),
          U('photo-1722082933604-288a1c130475')
        ]
      },
      {
        name: 'Lower Kachura Lake (Shangrila)',
        city: 'Skardu',
        country: 'Pakistan',
        region: 'Northern Areas',
        category: 'Lakes',
        description: 'Resort lake near Skardu — red huts, boating, easy add-on with Skardu city trips.',
        coordinates: { lat: 35.4167, lng: 75.4667 },
        isPopular: true,
        bestSeason: 'summer',
        images: [
          U('photo-1604676055604-fe96097e4f9f'),
          U('photo-1633584210825-e0a95a64e653'),
          U('photo-1668197091449-0a2b87ef7650')
        ]
      }
    ];

    let added = 0;
    let skipped = 0;
    let updated = 0;

    for (const destData of destinations) {
      try {
        const safeName = escapeRegex(destData.name);
        const existing = await Destination.findOne({
          name: { $regex: new RegExp(`^${safeName}$`, 'i') }
        });

        if (existing) {
          Object.assign(existing, destData);
          await existing.save();
          updated++;
          console.log(`✅ Updated: ${destData.name}`);
        } else {
          const destination = new Destination(destData);
          await destination.save();
          added++;
          console.log(`✅ Added: ${destData.name} (${destData.category})`);
        }
      } catch (error) {
        console.error(`❌ Error adding ${destData.name}:`, error.message);
        skipped++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${added} destinations`);
    console.log(`   🔄 Updated: ${updated} destinations`);
    console.log(`   ⏭️  Skipped: ${skipped} destinations`);
    console.log(`\n🎉 Process completed!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}
