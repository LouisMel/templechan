const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var postSchema = new Schema({
	postNumber:Number,
	name:String,
	options:String,
	subject:String,
	image:String,
	music:String,
	comment:String,
	OPreplyNumber:Number,
	replies:Array,
	board:String,
	type:String,
	flag:String,
	timestamp:String,
	stickied:Boolean,
	bumpNumber:Number,
});

const postModel = mongoose.model('postModel', postSchema, 'posts');

module.exports = postModel;