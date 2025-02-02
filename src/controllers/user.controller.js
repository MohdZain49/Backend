import { asyncHandler } from "../util/asyncHandler.js";
import { ApiError } from "../util/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../util/cloudinary.js";
import { ApiResponse } from "../util/ApiResponse.js";

const registerUser = asyncHandler(async (req, res, next) => {
  // get user detail form frontend
  const { username, email, fullName, password } = req.body;
  console.log(
    `username: ${username}, email: ${email}, fullName: ${fullName}, password: ${password}`
  );

  // validation: check if any of the fields are empty
  if ([username, email, fullName, password].includes(undefined)) {
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
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // remove password and refresh token from the response
  const savedUser = await user
    .findById(user._id)
    .select("-password -refreshToken");

  // check if user is saved in the database
  if (!savedUser) {
    throw new ApiError(500, "User registration failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, savedUser, "User registered successfully"));
});

export { registerUser };
