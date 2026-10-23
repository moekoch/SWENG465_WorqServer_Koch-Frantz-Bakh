const { getDB } = require('../../services/database');

/**
 * @swagger
 * /api/avatars:
 *   post:
 *     summary: Create a new avatar
 *     description: Creates a new avatar and stores it in the database
 *     tags: [Avatar]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Avatar'
 *     responses:
 *       201:
 *         description: Avatar created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Avatar'
 *       400:
 *         description: Bad request, missing required fields or invalid data types
 *       409:
 *         description: An avatar with that imageKey already exists
 *       500:
 *         description: Internal server error, failed to create avatar
 */
const createAvatar = async (req, res) => {
  //get data from request body
  const { name, color, price, imageKey } = req.body;

  // validate required fields
  if(!name || !imageKey || !price){
    return res.status(400).json({
      error: 'Missing required fields: name, imageKey, and price are required.'
    })
  }

  // validate price is a number
  if(typeof price !== 'number' || price < 0){
    return res.status(400).json({
      error: 'Invalid data type: price must be a number.'
    })
  }

  // image key must only use letters, numbers, - and _
  if(typeof imageKey !== 'string' || !/^[A-Za-z0-9_-]+$/.test(imageKey)){
    return res.status(400).json({
      error: 'Invalid imageKey: use only letters, numbers, - and _.'
    })
  }

  // color is optional must be a string
  if(color !== undefined && typeof color !== 'string'){
    return res.status(400).json({
      error: 'Invalid data type: color must be a string.'
    })
  }

  //create a new avatar object
  try{
    //get database
    const db = getDB();

    //get avatars collection
    const avatars = db.collection('avatars');

    // imageKey must be unique
    const existing = await avatars.findOne({ imageKey });
    if(existing){
      return res.status(409).json({
        error: 'An avatar with that imageKey already exists.'
      })
    }

    //create avatar document
    const newAvatar = {
      name: name,
      imageKey: imageKey,
      price: price
    };
    if(color !== undefined) newAvatar.color = color;

    //insert document into mongo
    const result = await avatars.insertOne(newAvatar);

    //add mongo generated id to response
    newAvatar._id = result.insertedId;

    //respond with created status and new avatar
    res.status(201).json(newAvatar);
  } catch (error) {
    console.error('Error creating avatar:', error);
    res.status(500).json({error: 'Failed to create avatar.'});
  }
};

module.exports = createAvatar;