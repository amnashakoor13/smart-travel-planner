const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your_jwt_secret_key_here', {
    expiresIn: '7d'
  });
};

const getMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, contactNumber, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = new User({
      name,
      email,
      contactNumber,
      password,
      role: 'user'
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    const transporter = getMailTransporter();
    if (!transporter) {
      return res.status(500).json({
        message: 'Email service is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in backend .env'
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendBase}/forgot-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(normalizedEmail)}`;

    const appName = process.env.APP_NAME || 'Smart Travel Buddy';
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"${appName}" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: `${appName} - Password Reset Request`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#1f2937;">
          <h2 style="margin-bottom:8px;">Password Reset Request</h2>
          <p>Hi ${user.name || 'Traveler'},</p>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#004a99;color:#ffffff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>If the button does not work, use this link:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `
    });

    res.status(200).json({ message: 'If this email is registered, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      contactNumber,
      bio,
      location,
      travelStyle,
      accommodationType,
      interests,
      budgetRange,
      notificationEmail,
      notificationSMS,
      notificationPush,
      weeklyDigest
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (contactNumber !== undefined) user.contactNumber = contactNumber;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (travelStyle !== undefined) user.preferences.set('travelStyle', travelStyle);
    if (accommodationType !== undefined) user.preferences.set('accommodationType', accommodationType);
    if (interests !== undefined) user.preferences.set('interests', Array.isArray(interests) ? interests : [interests]);
    if (budgetRange !== undefined) user.preferences.set('budgetRange', budgetRange);
    if (notificationEmail !== undefined) user.preferences.set('notificationEmail', Boolean(notificationEmail));
    if (notificationSMS !== undefined) user.preferences.set('notificationSMS', Boolean(notificationSMS));
    if (notificationPush !== undefined) user.preferences.set('notificationPush', Boolean(notificationPush));
    if (weeklyDigest !== undefined) user.preferences.set('weeklyDigest', Boolean(weeklyDigest));

    await user.save();
    const updated = await User.findById(user._id).select('-password');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
