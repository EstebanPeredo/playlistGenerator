const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config({
  path: ".env",
});

async function getSpotifyAccessToken() {
  const url = "https://accounts.spotify.com/api/token";
  const headers = {
    Authorization:
      "Basic " +
      Buffer.from(
        process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET
      ).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const data = querystring.stringify({ grant_type: "client_credentials" });

  try {
    const response = await axios.post(url, data, { headers });
    return response.data.access_token;
  } catch (error) {
    console.error(error);
  }
}
const app = express();

app.set("view engine", "ejs");

mongoose.connect(
  `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.awfbfgh.mongodb.net/${process.env.MONGO_DB_NAME}?retryWrites=true&w=majority`,
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const db = mongoose.connection;

const UserPreferenceSchema = new mongoose.Schema({
  playListName: {
    type: String,
    required: true,
  },
  genre: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  track: {
    type: String,
    required: true,
  },
  danceability: {
    type: Number,
    min: 0,
    max: 1,
  },
  energy: {
    type: Number,
    min: 0,
    max: 1,
  },
  valence: {
    type: Number,
    min: 0,
    max: 1,
  },
  popularity: {
    type: Number,
    min: 0,
    max: 100,
  },
  limit: {
    type: Number,
    min: 1,
    max: 100,
  },
});

const UserPreference = mongoose.model("UserPreference", UserPreferenceSchema);

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/form", (req, res) => {
  res.sendFile(__dirname + "/form.html");
});

app.post("/form", (req, res) => {
  const userPreference = new UserPreference({
    playListName: req.body.playListName,
    genre: req.body.genre,
    artist: req.body.artist,
    track: req.body.track,
    danceability: req.body.danceability,
    energy: req.body.energy,
    valence: req.body.valence,
    popularity: req.body.popularity,
    limit: req.body.limit,
  });

  userPreference
    .save()
    .then(() => res.redirect("/"))
    .catch((err) => console.error(err));
});

app.get("/query", (req, res) => {
  res.sendFile(__dirname + "/query.html");
});

app.post("/query", async (req, res) => {
  const spotifyAccessToken = await getSpotifyAccessToken();
  const userPreference = await UserPreference.findOne({
    playListName: req.body.playListName,
  });

  if (!userPreference) {
    return res.status(404).send("Playlist not found");
  }

  const artistResponse = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      userPreference.artist
    )}&type=artist&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    }
  );
  const artistId = artistResponse.data.artists.items[0].id;

  const trackResponse = await axios.get(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      userPreference.track
    )}&type=track&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    }
  );
  const trackId = trackResponse.data.tracks.items[0].id;

  const url = `https://api.spotify.com/v1/recommendations?seed_genres=${userPreference.genre}&seed_artists=${artistId}&seed_tracks=${trackId}&target_danceability=${userPreference.danceability}&target_energy=${userPreference.energy}&target_valence=${userPreference.valence}&limit=${userPreference.limit}`;

  axios
    .get(url, {
      headers: {
        Authorization: "Bearer " + spotifyAccessToken,
        "Content-Type": "application/json",
      },
    })
    .then((response) => {
      let recommendedTracks = response.data.tracks;

      res.render("results", { tracks: recommendedTracks });
    })
    .catch((error) => {
      console.error(error);
    });
});

app.post("/clear-database", async (req, res) => {
  try {
    await db.collection(process.env.MONGO_COLLECTION).deleteMany({});
    res.json({ message: "Database cleared." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to clear database." });
  }
});

app.listen(5001, () => console.log("Server started on port 5001"));
