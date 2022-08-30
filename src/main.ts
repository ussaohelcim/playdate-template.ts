/// <reference types="playdate-types" />

require("CoreLibs/object");
require("CoreLibs/sprites");
require("CoreLibs/graphics");

playdate.update = () => {
	playdate.graphics.fillCircleAtPoint(Math.random() * 400,Math.random() * 240,5)
}