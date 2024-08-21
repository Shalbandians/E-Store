const ErrorHandler = require("../utills/Errorhandler")

module.exports = (err, req, res, next) => {
    err.statusCode === err.statusCode || 500;
    err.message = err.message || "Internal server error"

    // wrong mongodb id error
    if (err.name === "CastError") {
        const message = `Resorces are not found with this id..invalid ${err.path}`
        err = new ErrorHandler(message, 400)
    }

    //Duplicate key error
    if (err.statusCode === 11000) {
        const message = ` Duplicate key ${Object.keys(err.keyValue)} Entered`
        err = new ErrorHandler(message, 400)
    }

    // wrong jwt error
    if (err.name === "JsonWebTokenError") {
        const message = ` Your url is invalid please try again later`
        err = new ErrorHandler(message, 400)
    }
    // jwt expired

    if (err.name === "TokenExpiredErron") {
        const message = `Your url is expired please try again later`
        err = new ErrorHandler(message, 400)
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    })
}