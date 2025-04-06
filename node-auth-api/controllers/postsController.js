const Post = require('../models/postsModel');
const {
  createPostSchema,
  updatePostSchema,
} = require('../middlewares/validator');

// get all posts
exports.getPosts = async (req, res) => {
  const { page } = req.query;
  const postsPerPage = 10;
  try {
    // check if the page is valid
    let pageNum = 0;
    if (page <= 1) {
      pageNum = 0;
    } else {
      pageNum = page - 1;
    }
    // get the posts
    const result = await Post.find()
      .sort({ createdAt: -1 })
      .skip(pageNum * postsPerPage)
      .limit(postsPerPage)
      .populate({ path: 'userId', select: 'email' });
    // send the posts
    res.status(200).json({
      success: true,
      message: 'Posts fetched successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// get single post
exports.singlePost = async (req, res) => {
  const { _id } = req.query;
  try {
    // check if the post exists
    const existingPost = await Post.findOne({ _id }).populate({
      path: 'userId',
      select: 'email',
    });
    if (!existingPost) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }
    // send the post
    res.status(200).json({
      success: true,
      message: 'Post fetched successfully',
      data: existingPost,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// create post
exports.createPost = async (req, res) => {
  const { title, description } = req.body;
  const { userId } = req.user;
  try {
    //validation
    const { error } = createPostSchema.validate({
      title,
      description,
      userId,
    });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    //creating a post
    const result = await Post.create({
      title,
      description,
      userId,
    });
    // send the post
    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// update post
exports.updatePost = async (req, res) => {
  const { _id } = req.query;
  const { title, description } = req.body;
  const { userId } = req.user;
  try {
    // validation
    const { error } = updatePostSchema.validate({
      title,
      description,
      userId,
    });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    // check if the post exists
    const existingPost = await Post.findOne({ _id });
    if (!existingPost) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }
    // check if the user is the owner of the post
    if (existingPost.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this post',
      });
    }
    // saving the updated post
    existingPost.title = title;
    existingPost.description = description;
    const result = await existingPost.save();
    // send the post
    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// delete post
exports.deletePost = async (req, res) => {
  const { _id } = req.query;
  const { userId } = req.user;
  try {
    // check if the post exists
    const existingPost = await Post.findOne({ _id });
    if (!existingPost) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }
    // check if the user is the owner of the post
    if (existingPost.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this post',
      });
    }
    // deleting the post
    await Post.deleteOne({ _id });
    // send the post
    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
