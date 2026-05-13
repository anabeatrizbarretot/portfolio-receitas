const mongoose = require("mongoose");

mongoose.connect(
  "mongodb://administrador:administrador@ac-5czhyxl-shard-00-00.tx6vn46.mongodb.net:27017,ac-5czhyxl-shard-00-01.tx6vn46.mongodb.net:27017,ac-5czhyxl-shard-00-02.tx6vn46.mongodb.net:27017/?ssl=true&replicaSet=atlas-bq2xe0-shard-0&authSource=admin&appName=Cluster0"
)
.then(() => {
  console.log("✅ Conectado ao MongoDB");
})
.catch((err) => {
  console.log("❌ Erro:");
  console.log(err);
});