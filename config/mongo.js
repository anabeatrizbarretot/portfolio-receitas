const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://administrador:administrador@cluster0.tx6yn46.mongodb.net/test"
)
.then(() => {
  console.log("✅ Conectado ao MongoDB");
})
.catch((err) => {
  console.log("❌ Erro:");
  console.log(err);
});