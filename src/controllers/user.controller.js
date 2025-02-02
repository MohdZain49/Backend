import { asyncHandler } from "../util/asyncHandler.js";

const registerUser = asyncHandler(async (req, res, next) => {
  res.status(201).json({ message: "User registered successfully" });
});

export { registerUser };