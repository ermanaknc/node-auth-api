const {
  signupSchema,
  signinSchema,
  acceptCodeSchema,
  changePasswordSchema,
} = require('../middlewares/validator');

const User = require('../models/usersModel');
const { doHash, doHashValidation, hmacProcess } = require('../utils/hashing');
const jwt = require('jsonwebtoken');
const transport = require('../middlewares/sendMail');

//signup
exports.signup = async (req, res) => {
  const { email, password } = req.body;
  try {
    //validation
    const { error } = signupSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    //user check
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: 'User already exists' });
    }
    //password hash
    const hashedPassword = await doHash(password, 12);
    const newUser = new User({ email, password: hashedPassword });
    const result = await newUser.save();
    result.password = undefined;
    // send the user
    res.status(201).json({
      success: true,
      message: 'User created successfully',
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

//signin
exports.signin = async (req, res) => {
  const { email, password } = req.body;
  try {
    //validation
    const { error } = signinSchema.validate({ email, password });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    // check if the user exists
    const existingUser = await User.findOne({ email }).select('+password');
    if (!existingUser) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid email or password' });
    }
    // check if the password is correct
    const result = await doHashValidation(password, existingUser.password);
    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid email or password' });
    }

    // generate the token
    const token = jwt.sign(
      {
        userId: existingUser._id,
        email: existingUser.email,
        verified: existingUser.verified,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: '8h' }
    );
    res
      .cookie('Authorization', 'Bearer ' + token, {
        expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
        httpOnly: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV === 'production',
      })
      .status(200)
      .json({
        success: true,
        message: 'User signed in successfully',
        token,
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

//signout
exports.signout = async (req, res) => {
  // clear the cookie
  res
    .clearCookie('Authorization')
    .status(200)
    .json({ success: true, message: 'User logged out successfully' });
};

// send-verification-code
exports.sendVerificationCode = async (req, res) => {
  const { email } = req.body;
  try {
    // check if the user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    // generate the code
    const codeValue = Math.floor(Math.random() * 1000000).toString();
    // send the code
    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADRESS,
      to: existingUser.email,
      subject: 'Verification Code',
      html: `<h1>Verification Code</h1>
      <p>Your verification code is ${codeValue}</p>`,
    });
    // check if the code is sent
    if (info.accepted[0] === existingUser.email) {
      // hash the code
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      // save the code
      existingUser.verificationCode = hashedCodeValue;
      existingUser.verificationCodeValidation = Date.now();
      await existingUser.save();
      return res.status(200).json({
        success: true,
        message: 'Verification code sent successfully',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

//verify-verification-code
exports.verifyVerificationCode = async (req, res) => {
  const { email, providedCode } = req.body;
  try {
    //validation
    const { error } = acceptCodeSchema.validate({ email, providedCode });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    // generate the code
    const codeValue = providedCode.toString();
    // check if the user exists
    const existingUser = await User.findOne({ email }).select(
      '+verificationCode +verificationCodeValidation'
    );
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    // check if the user is verified
    if (existingUser.verified) {
      return res
        .status(400)
        .json({ success: false, message: 'User already verified' });
    }
    // check if the code is saved
    if (
      !existingUser.verificationCode ||
      !existingUser.verificationCodeValidation
    ) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    // check if the code is expired
    if (Date.now() - existingUser.verificationCodeValidation > 5 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Code expired' });
    }
    // check if the code is correct
    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );
    if (hashedCodeValue === existingUser.verificationCode) {
      existingUser.verified = true;
      existingUser.verificationCode = undefined;
      existingUser.verificationCodeValidation = undefined;
      await existingUser.save();
      return res
        .status(200)
        .json({ success: true, message: 'User verified successfully' });
    }
    return res
      .status(400)
      .json({ success: false, message: 'Invalid verification code' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

//change-password
exports.changePassword = async (req, res) => {
  const { id, verified } = req.user;
  const { oldPassword, newPassword } = req.body;
  try {
    //validation
    const { error } = changePasswordSchema.validate({
      newPassword,
      oldPassword,
    });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    // check if the user is verified
    if (!verified) {
      return res
        .status(403)
        .json({ success: false, message: 'User not verified' });
    }
    // check if the user exists
    const existingUser = await User.findOne({ _id: id }).select('+password');
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    // check if the old password is correct
    const result = await doHashValidation(oldPassword, existingUser.password);
    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid old password' });
    }
    // hash the new password
    const hashedPassword = await doHash(newPassword, 12);
    // save the new password
    existingUser.password = hashedPassword;
    await existingUser.save();
    return res
      .status(200)
      .json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

//send-forgot-password-code
exports.sendForgotPasswordCode = async (req, res) => {
  const { email } = req.body;
  try {
    // check if the user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not exist!' });
    }
    // generate the code
    const codeValue = Math.floor(Math.random() * 1000000).toString();
    // send the code
    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADRESS,
      to: existingUser.email,
      subject: 'Forgot Password Code',
      html: `<h1>Forgot Password Code</h1>
      <p>Your forgot password code is ${codeValue}</p>`,
    });
    // check if the code is sent
    if (info.accepted[0] === existingUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      // save the code
      existingUser.forgotPasswordCode = hashedCodeValue;
      existingUser.forgotPasswordCodeValidation = Date.now();
      await existingUser.save();
      return res
        .status(200)
        .json({ success: true, message: 'Verification code sent!' });
    }
  } catch (error) {
    console.log(error);
  }
};

//verify-forgot-password-code
exports.verifyForgotPasswordCode = async (req, res) => {
  const { email, providedCode, newPassword } = req.body;
  try {
    //validation
    const { error } = acceptFPCodeSchema.validate({
      email,
      providedCode,
      newPassword,
    });
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    const codeValue = providedCode.toString();
    // check if the user exists
    const existingUser = await User.findOne({ email }).select(
      '+forgotPasswordCode +forgotPasswordCodeValidation'
    );
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not exist!' });
    }
    // check if the code is saved
    if (
      !existingUser.forgotPasswordCode ||
      !existingUser.forgotPasswordCodeValidation
    ) {
      return res.status(400).json({ success: false, message: 'Invalid code!' });
    }
    // check if the code is expired
    if (
      Date.now() - existingUser.forgotPasswordCodeValidation >
      5 * 60 * 1000
    ) {
      return res.status(400).json({ success: false, message: 'Code expired!' });
    }
    // check if the code is correct
    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );
    if (hashedCodeValue === existingUser.forgotPasswordCode) {
      // hash the new password
      const hashedPassword = await doHash(newPassword, 12);
      // save the new password
      existingUser.password = hashedPassword;
      existingUser.forgotPasswordCode = undefined;
      existingUser.forgotPasswordCodeValidation = undefined;
      await existingUser.save();
      return res
        .status(200)
        .json({ success: true, message: 'Password changed!' });
    }
    return res
      .status(400)
      .json({ success: false, message: 'Unexpected error!' });
  } catch (error) {
    console.log(error);
  }
};
