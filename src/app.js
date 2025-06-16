require('dotenv').config()
const express= require('express')
const routes=require('./routes/main.js')
const sellerRoutes = require('./routes/seller.js')
const connectDB=require('../db/connect')
const hbs=require('hbs')
const mongooses=require('mongoose')
const BodyParser=require('body-parser')

const {default: mongoose}=require('mongoose')

const app= express()

app.use(BodyParser.urlencoded({ extended: true }))
app.use("/static",express.static("public"))
app.use("",routes)
app.use("/seller", sellerRoutes)
app.use("/admin", require("./routes/admin"));
app.use(express.json())

app.set('view engine', 'hbs')
app.set("views","views")

hbs.registerPartials("views/partials")
hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

hbs.registerHelper('formatDate', function(date, format) {
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
});
hbs.registerHelper('split', function(str, delimiter, index) {
  if (!str) return '';
  return str.split(delimiter)[index] || '';
});
hbs.registerHelper('jsEscape', function(str) {
    if (str === undefined || str === null) return '';
    str = String(str);
    return str
        .replace(/\\/g, '\\\\')   // Escape backslashes FIRST
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, '\\n');
});
hbs.registerHelper('json', function(context) {
  return JSON.stringify(context).replace(/"/g, '&quot;');
});

hbs.registerHelper('ifGreater', function (a, b, options) {
  return (a > b) ? options.fn(this) : options.inverse(this);
});

mongoose.set('strictQuery', false);

// const securePassword = async(password)=>{
//     const passwordHash = await bcrypt.hash(password,10);
//     console.log(passwordHash);

//     const passwordMatch = await bcrypt.compare(password,passwordHash);
//     console.log(passwordMatch);
// }
// securePassword("anay");


const port= process.env.PORT || 8000
const start=async () =>{
try {
    connectDB(process.env.MONGO_URI)
    console.log('Connected to database!')
    // Product.deleteMany()
    // Product.create(jsonProduct)
    app.listen(port, console.log(`Server listening on ${port}...`))
} catch (error) {
    console.log(error)
}}

start()