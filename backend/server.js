const app = require("./app");
const connectDatabase = require("./db/Database");




process.on("uncaughtException", (err) => {
    console.log(`Error : ${err.message}`);
    console.log(`shutting down the server for handling the uncaught exception `);
})



// config
if (process.env.NODE_ENV !== "PRODUCTION") {
    require("dotenv").config({
        path: "config/.env"
    })
}
//connected Database
connectDatabase();

//create server

const server = app.listen(process.env.PORT, () => {
    console.log(`Server is runing on http://localhost:${process.env.PORT}`)
})



//unhandle promise rejection
process.on("unhandledRejection", (err) => {
    console.log(`shutting down the server for ${err.message}`)
    console.log(`shuting down the server for unhalde rejection`)

    server.close(() => {
        process.exit(1);
    });
});
