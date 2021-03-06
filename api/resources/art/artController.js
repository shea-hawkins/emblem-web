const router = require('express').Router();
const db = require('../../db/db');
const { Art, Place, TRAILING_DEC_SECTOR, getSector } = db;

const AWS = require('aws-sdk');

// Set up region for requests
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ID,
  secretAccessKey: process.env.AWS_SECRET,
});

// Create reference to existing bucket
const s3bucket = new AWS.S3({ params: { Bucket: 'hadashco-emblem' } });

module.exports = {

/* ***************************************************************

                      BEGIN AWS PORTION

*****************************************************************/
// Art can be accessed at the following link:
//  'https://s3.amazonaws.com/hadashco-emblem/' + art.id

// Post and store new art
  postNewArt: (req, res) => {
    const fileType = req.headers['file-type'];
    Art.create({ type: fileType })
      .then(art => {
        art.setUser(req.user); // add creator ID
        const params = {
          ACL: 'public-read',
          Key: art.id.toString(),
          Body: req.body,
          ContentEncoding: 'base64', // binary
          ContentType: fileType,
        };

        s3bucket.upload(params, (err, data) => {
          if (err) {
            res.status(401).json(err);
          } else {
            res.status(200).json(data);
          }
        });
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },

  downloadById: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        const params = { Key: art.id.toString() };
        s3bucket.getObject(params, (err, data) => {
          if (!err) {
            // Reference additional Body properties:
            // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
            res.status(200).send(data.Body);
          } else {
            res.status(500).send(err);
          }
        });
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },


// Delete art and corresponding artPlace
  deleteById: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        if (art) {
          art.destroy()
            .then(() => {
              const params = { Key: req.params.id.toString() };
              s3bucket.deleteObject(params, (err, data) => {
                if (!err) {
                  res.status(200).send(data.Body);
                } else {
                  res.status(500).send(err);
                }
              });
            });
        } else {
          res.status(204).send(`No art found in database at ArtId ${req.params.id}.`);
        }
      })
      .catch(err => {
        res.status(500).send(JSON.stringify(err));
      });
  },

/* ***************************************************************

                      END AWS PORTION

*****************************************************************/

// Get specific art
  getFromDbById: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        res.status(200).json(art);
      })
      .catch(err => {
        res.status(500).send(JSON.stringify(err));
      });
  },

  // Get all art
  getAllFromDb: (req, res) => {
    Art.findAll()
      .then(arts => {
        res.status(200).send(JSON.stringify(arts));
      })
      .catch(err => {
        res.status(500).send(JSON.stringify(err));
      });
  },

  // Post art to a specific place
  postToPlaceById: (req, res) => {
    let globalArt;
    Art.findById(req.params.id)
      .then(art => {
        globalArt = art;
        const sector = getSector(Number(req.body.lat), Number(req.body.long));
        Place.findAll({ where: { sector } })
          .then(place => {
            if (place.length > 0) {
              globalArt.addPlace(place)
                .then(res.status(200).json(globalArt));
            } else {
              Place.create({
                long: req.body.long,
                lat: req.body.lat,
                sector,
              })
              .then(newPlace => {
                globalArt.addPlace(newPlace)
                  .then(updatedArt => { res.status(200).json(updatedArt); });
              });
            }
          })
          .catch(err => res.status(500).send(JSON.stringify(err)));
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },

  // Add comment to art
  addCommentById: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        if (art) {
          art.createComment({
            title: req.body.title,
          })
          .then(comment => {
            comment.setUser(req.user); // add creator ID
            res.status(200).json(comment);
          })
          .catch(err => res.status(500).send(JSON.stringify(err)));
        } else {
          res.status(200).send(JSON.stringify(`No artwork associated with id ${req.params.id}`));
        }
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },

  // Get all comments for art
  getAllCommentsForId: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        console.log('--- art found');
        if (art) {
          art.getComments()
            .then(comments => {
              console.log('--- comments found');
              res.status(200).json(comments);
            })
            .catch(err => res.status(500).send(JSON.stringify(err)));
        } else {
          console.log('--- no comments found');
          res.status(200).send(JSON.stringify(`No artwork associated with id ${req.params.id}`));
        }
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },

  // Add vote to vote model, increment art upvote / downvote
    // vote value (+1 or -1)
  voteById: (req, res) => {
    let globalArt;
    Art.findById(req.params.id)
      .then(art => {
        if (art) {
          globalArt = art;
          art.createVote({
            value: req.body.vote,
          })
          .then(vote => {
            vote.setUser(req.user); // add creator ID
            if (req.body.vote > 0) globalArt.increment('upvotes');
            if (req.body.vote < 0) globalArt.increment('downvotes');
            res.status(200).json(vote);
          })
          .catch(err => res.status(500).send(JSON.stringify(err)));
        } else {
          res.status(200).send(JSON.stringify(`No artwork associated with id ${req.params.id}`));
        }
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },

  // Get votes for a specific Art ID
  getAllVotesForId: (req, res) => {
    Art.findById(req.params.id)
      .then(art => {
        if (art) {
          art.getVotes()
            .then(votes => {
              res.status(200).json(votes);
            })
            .catch(err => res.status(500).send(JSON.stringify(err)));
        } else {
          res.status(200).send(JSON.stringify(`No artwork associated with id ${req.params.id}`));
        }
      })
      .catch(err => res.status(500).send(JSON.stringify(err)));
  },
};
