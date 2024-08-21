const express = require("express");
const path = require("path");
const fs = require("fs");
const sendMail = require("../utills/sendMail");
const sendToken = require("../utills/jwtToken");
const jwt = require("jsonwebtoken");
const catchAsyncError = require("../middleware/catchAsyncError");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const { upload } = require("../multer");
const Shop = require("../model/shop");
const ErrorHandler = require("../utills/Errorhandler");
const sendShopToken = require("../utills/shopToken");

const router = express.Router();

router.post("/create-shop", upload.single("file"), async (req, res, next) => {
  try {
    const { email } = req.body;
    const sellerEmail = await Shop.findOne({ email });
    if (sellerEmail) {
      const filename = req.file.filename;
      const filePath = `uploads/${filename}`;
      fs.unlink(filePath, (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ message: "Error deleting file" });
        }
      });
      return next(new ErrorHandler("User already exists", 400));
    }
    const filename = req.file.filename;
    const fileUrl = path.join(filename);
    const seller = {
      name: req.body.name,
      email: email,
      password: req.body.password,
      avatar: fileUrl,
      address: req.body.address,
      phoneNumber: req.body.phoneNumber,
      zipCode: req.body.zipCode,
    };
    const activationToken = createActivationToken(seller);
    const activationUrl = `http://localhost:3000/shop/activation/${activationToken}`;

    try {
      await sendMail({
        email: seller.email,
        subject: "Activate Your Shop",
        message: ` Hello ${seller.name} please click on the link to activate your shop ${activationUrl} `,
      });
      res.status(201).json({
        success: true,
        message: `please check your email:- ${seller.email} to activate your shop`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});
// create activation Token
const createActivationToken = (seller) => {
  return jwt.sign(seller, process.env.ACTIVATION_SECRET, {
    expiresIn: "5m",
  });
};

// activate shop
router.post(
  "/activation",
  catchAsyncError(async (req, res, next) => {
    try {
      const { activation_token } = req.body;
      const newSeller = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newSeller) {
        return new ErrorHandler("Invalid Token", 400);
      }
      const { name, email, password, avatar, zipCode, address, phoneNumber } =
        newSeller;
      let seller = await Shop.findOne({ email });
      if (seller) {
        return next(new ErrorHandler("User already exist", 400));
      }

      seller = await Shop.create({
        name,
        email,
        avatar,
        password,
        zipCode,
        address,
        phoneNumber,
      });
      sendShopToken(seller, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//login shop
router.post(
  "/login-shop",
  catchAsyncError(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please provide the all fields!", 400));
      }

      const user = await Shop.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User doesn't exists!", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(
          new ErrorHandler("Please provide the correct information", 400)
        );
      }

      sendShopToken(user, 201, res);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// load shop
router.get(
  "/getSeller",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const seller = await Shop.findById(req.seller._id);

      if (!seller) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        seller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);
//logout from shop
router.get(
  "/logout",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      res.cookie("seller_token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
      });
      res.status(201).json({
        success: true,
        message: "Log out successful!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get shop info
router.get(
  "/get-shop-info/:id",
  catchAsyncError(async (req, res, next) => {
    try {
      const shop = await Shop.findById(req.params.id);
      res.status(201).json({
        success: true,
        shop,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update shop profile picture
router.put("/update-shop-avatar", isSeller, upload.single("image"), catchAsyncError(async (req, res, next) => {
  try {
      const existsSeller  = await Shop.findById(req.seller._id);
      if (!existsSeller ) {
          throw new Error("User not found");
      }

      const existAvatarPath = path.join('uploads', existsSeller .avatar);

      if (fs.existsSync(existAvatarPath)) {
          fs.unlinkSync(existAvatarPath);
      } else {
          console.log('File does not exist:', existAvatarPath);
      }

      const fileUrl = path.join(req.file.filename);

      const user = await Shop.findByIdAndUpdate(req.seller._id, { avatar: fileUrl }, { new: true });

      console.log(user);
      res.status(201).json({
          success: true,
          user,
      });
  } catch (error) {
      return next(new ErrorHandler(error.message, 500));
  }
}));


// update seller info
router.put(
  "/update-seller-info",
  isSeller,
  catchAsyncError(async (req, res, next) => {
      try {
          const { name, description, address, phoneNumber,zipCode } = req.body;

          const shop = await Shop.findOne(req.seller._id);
          if (!shop) {
              return next(new ErrorHandler("User not found", 400));
          }

       

          shop.name = name;
          shop.description = description;
          shop.address = address;
          shop.phoneNumber = phoneNumber;
          shop.zipCode = zipCode;
          await shop.save();

          res.status(201).json({
              success: true,
              shop,
          });
      } catch (error) {
          return next(new ErrorHandler(error.message, 500));
      }
  })
);
// all sellers --- for admin
router.get("/admin-all-sellers",isAuthenticated,isAdmin("Admin"),  catchAsyncError(async (req, res, next) => {
  try {
    const sellers = await Shop.find().sort({createdAt: -1 })
    res.status(200).json({
      success: true,
      sellers,
    });
    
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));

  }
}))


// delete seller for Admin
router.delete("/delete-seller/:id", isAuthenticated, isAdmin("Admin"), catchAsyncError(async (req, res, next) => {
  try {
      const seller = await Shop.findById(req.params.id);
      if (!seller) {
          return next(new ErrorHandler("User is not available with this id !", 400));
      }
      await Shop.findByIdAndDelete(req.params.id)

      res.status(201).json({
          success: true,
          message: "Seller deleted successfully!"
      })
  } catch (error) {
      return next(new ErrorHandler(error.message, 500));

  }
}))

// update seller withdraw methods --- sellers
router.put("/update-payment-methods",isSeller, catchAsyncError(async(req,res,next)=>{
  try {
    const {withdrawMethod}= req.body;
    const seller= await Shop.findByIdAndUpdate(req.seller._id,{
      withdrawMethod, 
    })
    res.status(201).json({
      success: true,
      seller,
  })
  } catch (error) {
    return next(new ErrorHandler(error.message,500))
  }
}))

// delete seller withdraw merthods --- only seller
router.delete("/delete-withdraw-method", isSeller,catchAsyncError(async(req,res,next)=>{
  try {
 
    const seller= await Shop.findById(req.seller._id)
    if(!seller){
      return next(new ErrorHandler("Seller not found with this id", 400));
    }
    seller.withdrawMethod=null;
    await seller.save()
    res.status(201).json({
      success: true,
      seller,
  })
  } catch (error) {
    return next(new ErrorHandler(error.message,500))
  }
}))

module.exports = router;
