const express = require("express");
const catchAsyncError = require("../middleware/catchAsyncError");
const Conversation = require("../model/conversation");
const ErrorHandler = require("../utills/Errorhandler");
const { isSeller, isAuthenticated } = require("../middleware/auth");
const e = require("express");
const router = express.Router();

//create a new conversation
router.post(
    "/create-new-conversation", catchAsyncError(async (req, res, next) => {
        try {
            const { groupTitle, userId, sellerId } = req.body;
            const isconversationExist = await Conversation.findOne({ groupTitle });
            if (isconversationExist) {
                const conversation = isconversationExist
                res.status(201).json({
                    success: true,
                    conversation,
                })
            } else {
                const conversation = await Conversation.create({
                    members: [userId, sellerId],
                    groupTitle: groupTitle
                });
                res.status(201).json({
                    success: true,
                    conversation,
                })
            }

        } catch (error) {
            return next(new ErrorHandler(error.response.message), 500)
        }


    }))

// get seller conversations 
router.get(
    "/get-all-conversation-seller/:id",
    isSeller,
    catchAsyncError(async (req, res, next) => {
      try {
        console.log(req.params.id)
        const conversations = await Conversation.find({
          members: {
            $in: [req.params.id],
          },
        }).sort({ updatedAt: -1, createdAt: -1 });
  
        res.status(201).json({
          success: true,
          conversations,
        });
      } catch (error) {
        return next(new ErrorHandler(error), 500);
      }
    })
  );

// get user conversations
router.get(
  "/get-all-conversation-user/:id",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      console.log(req.params.id)
      const conversations = await Conversation.find({
        members: {
          $in: [req.params.id],
        },
      }).sort({ updatedAt: -1, createdAt: -1 });

      res.status(201).json({
        success: true,
        conversations,
      });
    } catch (error) {
      return next(new ErrorHandler(error), 500);
    }
  })
);

  // update the Last Message
  router.put("/update-last-message/:id", catchAsyncError(async(req,res,next)=>{
    try {
      const { lastMessage, lastMessageId}= req.body;
      const conversation = await Conversation.findByIdAndUpdate(req.params.id,{
        lastMessage,
        lastMessageId,
      });
      res.status(201).json({
        success: true,
        conversation
      })

    } catch (error) {
      return next(new ErrorHandler(error), 500);

    }
  }))

module.exports = router;