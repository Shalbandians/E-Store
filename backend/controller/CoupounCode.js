const express = require("express");
const catchAsyncError = require("../middleware/catchAsyncError");
const Shop = require("../model/shop");
const ErrorHandler = require("../utills/Errorhandler");
const { isSeller } = require("../middleware/auth");
const CouponCode = require("../model/coupounCode");
const router = express.Router();

// Create Coupouns

router.post(
  "/create-coupoun-code",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const isCoupounCodeExits = await CouponCode.find({
        name: req.body.name, 
      });
      if (isCoupounCodeExits.length !== 0) {
        return next(new ErrorHandler("Coupoun Code already exists", 400));
      }
      const coupounCode = await CouponCode.create(req.body);
      res.status(201).json({
        success: true,
        coupounCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);
// get all coupons
router.get(
  "/get-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const couponCodes = await CouponCode.find({
        shopId: req.seller.id,
      });
      res.status(201).json({
        success: true,
        couponCodes,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// delete Coupon by id
router.delete(
  "/delete-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const couponCode = await CouponCode.findByIdAndDelete(req.params.id);
      if (!couponCode) {
        return next(new ErrorHandler("Coupoun Code doesn't exist", 400));
      }
      res.status(201).json({
        success: true,
        message: "Coupon code deleted successfully!",
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get coupon code value by its name
router.get(
  "/get-coupon-value/:name",
  catchAsyncError(async(req,res,next)=>{
    try {
      const couponCode = await CouponCode.findOne({ name : req.params.name});
      res.status(200).json({
        success: true,
        couponCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
   
    }
  }))
module.exports = router;
