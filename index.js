const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const uid2 = require("uid2");
const app = express();
//permet de récupérer le contenu d'un body en text/plain
app.use(bodyParser.text({ type: "text/plain" }));
app.use(bodyParser.json());
//pour se connecter à la BDD mLab en ligne ou alors pour mes test en local à ma BDD justify
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/justify"
);

//fonction  qui permettra de compter le nombre de mot dans une chaîne de caractère
function wordCount(str) {
  return str.split(" ").length;
}

///ENDPOINT TOKEN

//Définir le schéma de donnée pour les connexions
const userSchema = new mongoose.Schema({
  email: String,
  token: String,
  count: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now()
  },
  lastUpdate: Date
});

const User = mongoose.model("users", userSchema);

app.post("/api/token", function(req, res) {
  let newUser = new User({
    email: req.body.email,
    token: uid2(16)
  });

  newUser.save(function(err, obj) {
    if (err) {
      console.log("Error : User has not been added");
      res.json(err);
    } else {
      console.log("Message: : User has been added");
      res.json({
        token: obj.token
      });
    }
  });
});

//ENDPOINT JUSTIFY
app.post("/api/justify", function(req, res) {
  User.findOne({
    token: req.headers.authorization.replace("Bearer ", "") //trouver l'utilisateur qui correspond au token
  }).exec(function(err, obj) {
    //Erreur de communication (MONGODB, NETWORK ...)
    if (!err) {
      //Un utilisateur existe ?
      if (obj) {
        let date = new Date();

        if (
          obj.lastUpdate.getDate() !== date.getDate() ||
          obj.lastUpdate.getFullYear() !== date.getFullYear() ||
          obj.lastUpdate.getMonth() !== date.getMonth()
        ) {
          User.update({ token: obj.token }, { count: 0 }, function(err) {
            if (err) {
              console.log("error");
            }
          });
        }
        // je refais une requete pour récupérer les nouvelles valeurs suite à l'update à 0
        User.findOne({
          token: obj.token
        }).exec(function(err, obj) {
          if (obj.count + wordCount(req.body) > 80000) {
            //est-ce q'il a dépassé la limite de mot, si oui...
            res.status(402).json({ error: "Payment required" });
          } else {
            User.update(
              { token: obj.token },
              {
                count: obj.count + wordCount(req.body),
                lastUpdate: Date.now()
              }, // je mets à jour le nombre de mots réalisés avec le token en question
              function(err) {
                if (err) {
                  console.log("error");
                }
              }
            );

            let tempTxt = [];
            //on crée un tableau pour rentrer chaque caractère de la string
            for (let i = 0; req.body.length > i; i++) {
              if ((i + 1) % 80 === 0) {
                //si le caractère suivant est un multiple de 80, on s'occupe de la gestion des tirets
                if (req.body[i] === " ") {
                  tempTxt.push("\n"); //si le caractère est un espace, on passe seulement à la ligne
                } else if (req.body[i - 1] === " ") {
                  tempTxt.push("\n"); //si le caractère est d'avant est un espace, on passe seulement à la ligne, puis on continue
                  tempTxt.push(req.body[i]);
                } else {
                  tempTxt.push("-"); //sinon on ajoute un tiret pour couper un mot
                  tempTxt.push("\n");
                  tempTxt.push(req.body[i]);
                }
              } else {
                tempTxt.push(req.body[i]);
              }
            }
            res.json(tempTxt.join("")); //on transforme le tableau en chaîne de caractère et on l'envoie en tant que réponse
          }
        });
      } else {
        res.status(404).json({ error: "Invalid Token " });
      }
    }
  });
});

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started");
});
