import User from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponce } from '../utils/ApiResponce.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        return { accessToken, refreshToken };
    } catch (error) {
        console.log(error);
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    try {
        if (!(email && password && name)) {
            throw new ApiError(400, 'email, password and name are required');
        }
        const userExist = await User.findOne({ email });
        if (userExist) {
            throw new ApiError(400, 'User already exist');
        }
        const user = await User.create({
            email,
            password,
            name,
        });
        const { unHashToken, hashToken } = await user.generateTemporaryToken();
        user.emailVerificationToken = hashToken;
        await user.save();

        const createdUser = await User.findById(user._id).select(
            '-password -refreshToken -emailVerificationToken'
        );
        if (!createdUser) {
            throw new ApiError(500, 'something went wrong while creating user');
        }

        // todo: send email verification link

        resend.emails.send({
            from: 'shortener@updates.openurl.me',
            to: `${email}`,
            subject: 'Email verification',
            html: `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Email Confirmation</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f4f4;
                }
            
                .container {
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 5px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
            
                h1 {
                  color: #333333;
                }
            
                p {
                  color: #666666;
                }
            
                .button {
                  display: inline-block;
                  padding: 10px 20px;
                  text-decoration: none;
                  color: #eee;
                  background-color: #000;
                  border-radius: 3px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                 <h1>Hello, ${name}!</h1>
                <p>We're excited to have you on board. To get started, please verify your email address by clicking the button below.</p>
                
                <a style='color:#fff' class="button" href="${req.protocol}://${
                process.env.ORIGIN || `127.0.0.1:5173`
            }/auth/verify/${unHashToken}?email=${email}">Confirm Email</a>
            
                <p>If you did not sign up for an account, please ignore this email.</p>
              </div>
            </body>
            </html>
            `,
        });

        return res
            .status(201)
            .json(
                new ApiResponce(
                    201,
                    'User created',
                    { user: createdUser },
                    true
                )
            );
    } catch (error) {
        // console.log(error);
        res.status(error.statusCode || 500).json(
            new ApiError(error.statusCode || 500, error.message)
        );
        // throw new ApiError(error.statusCode || 500, error.message);
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!(email && password)) {
        return res
            .status(400)
            .json(new ApiError(400, 'all fields are required'));
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json(new ApiError(400, 'User not found'));
        }

        const checkPassword = await user.isCorrectPassword(password);
        if (!checkPassword) {
            return res.status(400).json(new ApiError(400, 'Invalid password'));
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user._id);

        const logedInUser = await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    refreshToken: refreshToken,
                },
            },
            {
                new: true,
            }
        ).select('-password -refreshToken -emailVerificationToken');

        return res
            .cookie('token', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            })
            .status(200)
            .json(
                new ApiResponce(
                    200,
                    'Login success',
                    {
                        user: logedInUser,
                        accessToken,
                    },
                    true
                )
            );
    } catch (error) {
        throw new ApiError(500, 'something went wrong while login', error);
    }
});

const logoutUser = asyncHandler(async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    refreshToken: undefined,
                },
            },
            {
                new: true,
            }
        );

        return res
            .clearCookie('token', {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
            })
            .status(200)
            .json(new ApiResponce(200, 'Logout success', null, true));
    } catch (error) {
        return res.status(500).json(new ApiError(500, error.message));
    }
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;
    console.log(token);
    if (!token) {
        throw new ApiError(400, 'verification token not found');
    }

    try {
        const hashToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const verifiedUser = await User.findOneAndUpdate({
            emailVerificationToken: hashToken,
        });
        console.log(verifiedUser);
        if (verifiedUser.isEmailVerified) {
            return res
                .status(203)
                .json(
                    new ApiResponce(
                        203,
                        'Email already verified',
                        undefined,
                        false
                    )
                );
        } else {
            verifiedUser.isEmailVerified = true;
            verifiedUser.emailVerificationToken = '';
            await verifiedUser.save();

            return res
                .status(200)
                .json(new ApiResponce(200, 'Email verified', undefined, true));
        }
    } catch (error) {
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'something went wrong while verifying email',
            error
        );
    }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const { token } = req.cookies;
        if (!token) {
            throw new ApiError(401, 'token not found');
        }
        const vaildateUser = jwt.verify(
            token,
            process.env.REFRESH_TOKEN_SECRET
        );
        if (!vaildateUser) {
            throw new ApiError(401, 'token not valid');
        }
        const user = await User.findById(vaildateUser._id);
        if (!user) {
            throw new ApiError(401, 'user not found');
        }
        if (token !== user.refreshToken) {
            throw new ApiError(401, 'token not valid');
        }
        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user._id);
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    refreshToken: refreshToken,
                },
            },
            {
                new: true,
            }
        ).select('-password -refreshToken -emailVerificationToken');
        return res
            .cookie('token', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            })
            .status(200)
            .json(
                new ApiResponce(
                    200,
                    'Access token refreshed',
                    { user: updatedUser, accessToken },
                    true
                )
            );
    } catch (error) {
        throw new ApiError(
            500,
            'something went wrong while refreshing access token'
        );
    }
});

export { registerUser, loginUser, logoutUser, verifyEmail, refreshAccessToken };
