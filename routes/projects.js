const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

// Get all projects with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const tag = req.query.tag || '';

    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'displayName photoURL');

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      'author',
      'displayName photoURL bio'
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Create project
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, tags, githubLink, liveLink } = req.body;

    // 1️⃣ Check if user exists
    let user = await User.findOne({ uid: req.user.uid });

    // 2️⃣ If not found, create automatically
    if (!user) {
      user = await User.create({
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.name || 'Unknown User',
        photoURL: req.user.picture || '',
      });
      console.log('✅ Auto-created new user:', user.email);
    }

    // 3️⃣ Create project for that user
    const project = new Project({
      title,
      description,
      tags: Array.isArray(tags) ? tags : [],
      githubLink,
      liveLink: liveLink || '',
      author: user._id,
      authorName: user.displayName,
    });

    await project.save();
    await project.populate('author', 'displayName photoURL');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    console.error('❌ Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (project.author.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { title, description, tags, githubLink, liveLink } = req.body;

    project.title = title || project.title;
    project.description = description || project.description;
    project.tags = tags || project.tags;
    project.githubLink = githubLink || project.githubLink;
    project.liveLink = liveLink !== undefined ? liveLink : project.liveLink;
    project.updatedAt = Date.now();

    await project.save();
    await project.populate('author', 'displayName photoURL');

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (project.author.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Toggle like
router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    const user = await User.findOne({ uid: req.user.uid });

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const index = project.likes.indexOf(user._id);
    if (index > -1) {
      project.likes.splice(index, 1);
    } else {
      project.likes.push(user._id);
    }

    await project.save();
    res.json({ likes: project.likes.length });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ⭐ Rate project (Star Rating)
router.post('/:id/rate', verifyToken, async (req, res) => {
  try {
    const { rating } = req.body;
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const project = await Project.findById(req.params.id);
    const user = await User.findOne({ uid: req.user.uid });

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user already rated
    const existingRating = project.ratings.find(
      (r) => r.user.toString() === user._id.toString()
    );

    if (existingRating) {
      existingRating.value = rating;
    } else {
      project.ratings.push({ user: user._id,rating });
    }

    // Recalculate average
    const totalRatings = project.ratings.length;
    const sum = project.ratings.reduce((acc, r) => acc + r.value, 0);
    project.averageRating = totalRatings > 0 ? sum / totalRatings : 0;

    await project.save();

    res.json({
      success: true,
      message: 'Rating updated successfully',
      averageRating: project.averageRating,
    });
  } catch (error) {
    console.error('Rate project error:', error);
    res.status(500).json({ error: 'Failed to rate project' });
  }
});

// Get my projects
router.get('/user/my-projects', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const projects = await Project.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate('author', 'displayName photoURL');

    res.json(projects);
  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

module.exports = router;
