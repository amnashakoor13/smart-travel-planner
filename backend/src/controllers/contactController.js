const ContactMessage = require('../models/ContactMessage');

exports.createContactMessage = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const user = req.user;

    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required.' });
    }

    const doc = await ContactMessage.create({
      userId: user._id,
      name: user.name || 'User',
      email: user.email || 'unknown@example.com',
      subject: String(subject).trim(),
      category: category === 'complaint' ? 'complaint' : 'general',
      message: String(message).trim()
    });

    return res.status(201).json({ message: 'Message sent successfully.', contact: doc });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message.', error: error.message });
  }
};

exports.getAllContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load messages.', error: error.message });
  }
};

exports.updateContactMessageStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const normalized = String(status || '').toLowerCase().trim();
    if (!['new', 'resolved'].includes(normalized)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status: normalized },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update message.', error: error.message });
  }
};
