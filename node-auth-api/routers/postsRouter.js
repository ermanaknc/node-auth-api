const express = require('express');
const { identifier } = require('../middlewares/identification');
const postsController = require('../controllers/postsController');
const router = express.Router();

// GET
router.get('/all-posts', postsController.getPosts);
router.get('/single-post', postsController.singlePost);

// POST
router.post('/create-post', identifier, postsController.createPost);

// PUT
router.put('/update-post', identifier, postsController.updatePost);

// DELETE
router.delete('/delete-post', identifier, postsController.deletePost);

module.exports = router;
