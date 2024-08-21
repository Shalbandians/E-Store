const express = require("express")
const path = require("path")
const { upload } = require("../multer")
const User = require("../model/user")
const ErrorHandler = require("../utills/Errorhandler")
const fs = require("fs");
const sendMail = require("../utills/sendMail");
const sendToken = require("../utills/jwtToken")
const jwt = require("jsonwebtoken")
const catchAsyncError = require("../middleware/catchAsyncError")
const { isAuthenticated, isAdmin } = require("../middleware/auth")
const router = express.Router()

router.post("/create-user", upload.single("file"), async (req, res, next) => {
    try {
        const { name, email, password, avatar } = req.body;
        console.log(req.body)

        const userEmail = await User.findOne({ email });

        if (userEmail) {
            const filename = req.file.filename
            const filePath = `uploads/${filename}`
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.log(err);
                    res.status(500).json({ message: "Error deleting file" })
                }
            })
            return next(new ErrorHandler("User already exists", 400));
        }

        const filename = req.file.filename;
        const fileUrl = path.join(filename);
        const user = {
            name: name,
            email: email,
            password: password,
            avatar: fileUrl
        }
        const activationToken = createActivationToken(user);
        const activationUrl = `http://localhost:3000/activation/${activationToken}`

        try {
            await sendMail({
                email: user.email,
                subject: "Activate Your Account",
                message: ` Hello ${user.name} please click on the link to activate your account ${activationUrl} `
            })
            res.status(201).json({
                success: true,
                message: `please check your email:- ${user.email} to activate your account`
            })
        } catch (error) {
            return next(new ErrorHandler(error.message, 500))
        }

    } catch (error) {
        return next(new ErrorHandler(error.message, 400))

    }

})

const createActivationToken = (user) => {
    return jwt.sign(user, process.env.ACTIVATION_SECRET, {
        expiresIn: "5m",
    });
};
// activate user
router.post("/activation", catchAsyncError(async (req, res, next) => {
    try {
        const { activation_token } = req.body;
        const newUser = jwt.verify(activation_token, process.env.ACTIVATION_SECRET)

        if (!newUser) {
            return new ErrorHandler("Invalid Token", 400)
        }
        const { name, email, password, avatar } = newUser
        let user = await User.findOne({ email })
        if (user) {
            return next(new ErrorHandler("User already exist", 400))

        }
        user = await User.create({
            name,
            email,
            avatar,
            password,

        })
        sendToken(user, 201, res)
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))

// login user

router.post(
    "/login-user",
    catchAsyncError(async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return next(new ErrorHandler("Please provide the all fields!", 400));
            }

            const user = await User.findOne({ email }).select("+password");

            if (!user) {
                return next(new ErrorHandler("User doesn't exists!", 400));
            }

            const isPasswordValid = await user.comparePassword(password);

            if (!isPasswordValid) {
                return next(
                    new ErrorHandler("Please provide the correct information", 400)
                );
            }

            sendToken(user, 201, res);
            console.log(res)
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);
//load user
router.get(
    "/getuser",
    isAuthenticated,
    catchAsyncError(async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return next(new ErrorHandler("User doesn't exists", 400));
            }

            res.status(200).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);


//log out 
router.get('/logout', isAuthenticated, catchAsyncError(async (req, res, next) => {
    try {
        res.cookie("token", null, {
            expires: new Date(Date.now()),
            httpOnly: true,

        })
        res.status(201).json({
            success: true,
            message: "Log out successful!"
        })

    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))

// update user info
router.put(
    "/update-user-info",
    isAuthenticated,
    catchAsyncError(async (req, res, next) => {
        try {
            const { email, password, phoneNumber, name } = req.body;

            const user = await User.findOne({ email }).select("+password");

            if (!user) {
                return next(new ErrorHandler("User not found", 400));
            }

            const isPasswordValid = await user.comparePassword(password);

            if (!isPasswordValid) {
                return next(
                    new ErrorHandler("Please provide the correct Password", 400)
                );
            }

            user.name = name;
            user.email = email;
            user.phoneNumber = phoneNumber;

            await user.save();

            res.status(201).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update avatar
router.put("/update-avatar", isAuthenticated, upload.single("image"), catchAsyncError(async (req, res, next) => {
    try {
        const existsUser = await User.findById(req.user.id);
        if (!existsUser) {
            throw new Error("User not found");
        }

        const existAvatarPath = path.join('uploads', existsUser.avatar);

        if (fs.existsSync(existAvatarPath)) {
            fs.unlinkSync(existAvatarPath);
        } else {
            console.log('File does not exist:', existAvatarPath);
        }

        const fileUrl = path.join(req.file.filename);

        const user = await User.findByIdAndUpdate(req.user.id, { avatar: fileUrl }, { new: true });

        console.log(user);
        res.status(201).json({
            success: true,
            user,
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
}));

// update user address

router.put("/update-user-adress", isAuthenticated, catchAsyncError(async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)

        const sameTypeAddress = user.addresses.find((address) => address.addressType === req.body.addressType);
        if (sameTypeAddress) {
            return next(new ErrorHandler(`${req.body.addressType} address already exists`));
        }
        const existAddress = user.addresses.find(address => address._id === req.body_id);
        if (existAddress) {
            Object.assign(existAddress, req.body)
        }
        else {
            // add the new address to the array
            user.addresses.push(req.body);
        }
        await user.save();
        res.status(200).json({
            success: true,
            user,
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))


// delete User Address
router.delete(
    "/delete-user-address/:id",
    isAuthenticated,
    catchAsyncError(async (req, res, next) => {
        try {
            const userId = req.user._id;
            const addressId = req.params.id;

            await User.updateOne(
                {
                    _id: userId,
                },
                { $pull: { addresses: { _id: addressId } } }
            );

            const user = await User.findById(userId);

            res.status(200).json({ success: true, user });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update user password
router.put("/update-user-password", isAuthenticated, catchAsyncError(async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select("+password");

        const isPasswordMatched = await user.comparePassword(
            req.body.oldPassword
        ); if (!isPasswordMatched) {
            return next(new ErrorHandler("Old password is incorrect", 400));
        }
        if (req.body.newPassword !== req.body.confirmPassword) {
            return next(new ErrorHandler("Password does not matched with each other!", 400));
        }
        user.password = req.body.newPassword;
        await user.save();
        res.status(200).json({ success: true, message: "Password updated Successfully!" });

    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))

// find user information with the userId
router.get("/user-info/:id", catchAsyncError(async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        res.status(201).json({
            success: true,
            user
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))

// all users --- for admin
router.get("/admin-all-users", isAuthenticated, isAdmin("Admin"), catchAsyncError(async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 })
        res.status(200).json({
            success: true,
            users,
        });

    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))

// delete user
router.delete("/delete-user/:id", isAuthenticated, isAdmin("Admin"), catchAsyncError(async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(new ErrorHandler("User is not available with this id !", 400));
        }
        await User.findByIdAndDelete(req.params.id)

        res.status(201).json({
            success: true,
            message: "User deleted successfully!"
        })
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));

    }
}))
module.exports = router;
