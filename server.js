'use strict'

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

require('dotenv').config();

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());

app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(locationData => response.send(locationData))
    .catch(error => handleError(error, response))
});

app.get('/weather', getWeather);

app.get('/yelp', getYelp);

app.get('/movies', getMovie);

function handleError(err, res){
  console.error('ERR', err);
  if (res) res.status(500).send('Oh NOOO!!!!  We\'re so sorry.  We really tried.');
}

function getLocation(query){
  const geoData = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_MAPS_API}`;
  return superagent.get(geoData)
    .then(data => {
      if (! data.body.results.length){ throw 'NO DATA';}
      else{
        let location = new Location(data.body.results[0]);
        location.search_query = query;
        return location;
      }
    });
}

function Location(data){
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

function getWeather(request, response){
  const URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API}/${request.query.data.latitude},${request.query.data.longitude}`;
  return superagent.get(URL)
    .then(forecastResults =>{
      response.send(forecastResults.body.daily.data.map((day)=>{
        return new DailyWeather(day);
      }));
    })
    .catch(error => handleError(error, response));
}

function getYelp(request, response){
  const URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;
  return superagent.get(URL)
    .set('Authorization', `Bearer ${process.env.YELP_API}`)
    .then(yelpResults =>{
      response.send(yelpResults.body.businesses.map((restaurants)=>{
        return new YelpRestaurants(restaurants);
      }));
    })
    .catch(error => handleError(error, response));
}

function getMovie(request, response){
  // console.log(request.query.data);
  let cityname = request.query.data.formatted_query.split(',')[0];
  // const URL = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MOVIES_API}&language=en-US&region=US&sort_by=popularity.desc&page=1`;
  const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIES_API}&language=en-US&query=${cityname}&page=1`
  return superagent.get(URL)
    .then(movie =>{
      console.log(movie);
      response.send(movie.body.results.map((results)=>{
        return new Movie(results);
      }));
    })
    .catch(error => handleError(error, response));
}

function DailyWeather(data){
  this.forecast = data.summary;
  this.time = new Date(data.time * 1000).toString().slice(0,15);
}

function YelpRestaurants(data){
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.url = data.url;
}

function Movie(data){
  this.title = data.title;
  this.overview = data.overview;
  this.average_vote = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/original/${data.poster_path}`;
  console.log(this.image_url);
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

app.listen(PORT, () => console.log(`App is up on ${PORT}`) );
