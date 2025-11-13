const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const verifyToken = require('../middleware/auth');

// Create or update user profile
router.post('/profile', verifyToken, async (req, res) => {
  try {
    const { displayName, photoURL, bio } = req.body;
    
    let user = await User.findOne({ uid: req.user.uid });
    
    if (user) {
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      user.bio = bio !== undefined ? bio : user.bio;
      await user.save();
    } else {
      user = new User({
        uid: req.user.uid,
        email: req.user.email,
        displayName: displayName || req.user.name || 'Anonymous',
        photoURL: photoURL || '',
        bio: bio || ''
      });
      await user.save();
    }
    
    res.json(user);
  } catch (error) {
    console.error('Profile creation error:', error);
    res.status(500).json({ error: 'Failed to create/update profile' });
  }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid })
      .select('-favorites');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const projects = await Project.find({ author: user._id })
      .sort({ createdAt: -1 });
    
    res.json({ user, projects });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    
    if (!user) {
      user = new User({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name || 'Anonymous',
        photoURL: req.user.picture || ''
      });
      await user.save();
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Toggle favorite
router.post('/favorites/:projectId', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    const projectId = req.params.projectId;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const index = user.favorites.indexOf(projectId);
    
    if (index > -1) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(projectId);
    }
    
    await user.save();
    res.json({ favorites: user.favorites });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get favorites
router.get('/favorites', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid })
      .populate('favorites');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

module.exports = router;