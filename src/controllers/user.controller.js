import { asyncHandler } from "../util/asyncHandler.js";
import { ApiError } from "../util/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../util/cloudinary.js";
import { ApiResponse } from "../util/ApiResponse.js";


const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    console.log(accessToken, refreshToken);

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh and access token")
  }
}

// controller for user routes

const registerUser = asyncHandler(async (req, res, next) => {
  // get user detail form frontend
  const { username, email, fullname, password } = req.body;
  console.log(
    `username: ${username}, email: ${email}, fullName: ${fullname}, password: ${password}`
  );

  // validation: check if any of the fields are empty
  if ([username, email, fullname, password].includes(undefined)) {
    throw new ApiError(400, "All fields are required");
  }

  // check if user already exists in the database
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  // check for images or avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath = "";

  if (
    req.files?.coverImage &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload avatar and cover image on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Failed to upload avatar");
  }

  // create new user
  const user = new User({
    username: username.toLowerCase(),
    email,
    fullname,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // save the user to the database
  const savedUser = await user.save();

  // remove password and refresh token from the response
  const userResponse = await User.findById(savedUser._id).select("-password -refreshToken");

  // check if user is saved in the database
  if (!savedUser) {
    throw new ApiError(500, "User registration failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, savedUser, "User registered successfully"));
});


const loginUser = asyncHandler(async (req, res, next) => {

  // get user details
  const { username, email, password } = req.body;

  // validation: check if any of the fields are empty
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  // check user exist or not
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist")
  }

  // check password is valid or not
  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
  }

  // generate accessToken and refreshToken
  const { accessToken, refreshToken } = await
    generateAccessTokenAndRefreshToken(user._id)

  // Retrieve the logged-in user's details from the database
  const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

  // Define options for the cookies (httpOnly and secure flags for security)
  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiError(
      200,
      {
        user: loggedInUser,
        refreshToken,
        accessToken
      },
      "User logged In Successfully")
    )
});


const logoutUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})




export { registerUser, loginUser, logoutUser };
