const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const User = require('../models/User');
const Comment = require('../models/Comment');

// Get analytics data
router.get('/', async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalComments = await Comment.countDocuments();
    
    const mostLikedProject = await Project.findOne()
      .sort({ likes: -1 })
      .populate('author', 'displayName');
    
    const topRatedProjects = await Project.find({ averageRating: { $gt: 0 } })
      .sort({ averageRating: -1 })
      .limit(5)
      .populate('author', 'displayName');
    
    const allTags = await Project.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      totalProjects,
      totalUsers,
      totalComments,
      mostLikedProject: mostLikedProject ? {
        title: mostLikedProject.title,
        likes: mostLikedProject.likes.length,
        author: mostLikedProject.author.displayName
      } : null,
      topRatedProjects: topRatedProjects.map(p => ({
        title: p.title,
        rating: p.averageRating,
        author: p.author.displayName
      })),
      popularTags: allTags.map(t => ({ tag: t._id, count: t.count }))
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

module.exports = router