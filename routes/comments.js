const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.get('/project/:projectId', async (req, res) => {
  try {
    const comments = await Comment.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })
      .populate('author', 'displayName photoURL');

    res.status(200).json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to load comments.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { text, projectId } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const comment = new Comment({
      text: text.trim(),
      project: projectId,
      author: user._id,
      authorName: user.displayName,
    });

    await comment.save();
    await comment.populate('author', 'displayName photoURL');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Authorization: Only author can delete
    if (comment.author.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this comment.' });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.',
    });
  } catch (error) {
    console.error(' Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

module.exports = router;
