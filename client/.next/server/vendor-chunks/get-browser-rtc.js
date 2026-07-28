/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/get-browser-rtc";
exports.ids = ["vendor-chunks/get-browser-rtc"];
exports.modules = {

/***/ "(ssr)/./node_modules/get-browser-rtc/index.js":
/*!***********************************************!*\
  !*** ./node_modules/get-browser-rtc/index.js ***!
  \***********************************************/
/***/ ((module) => {

eval("// originally pulled out of simple-peer\n\nmodule.exports = function getBrowserRTC () {\n  if (typeof globalThis === 'undefined') return null\n  var wrtc = {\n    RTCPeerConnection: globalThis.RTCPeerConnection || globalThis.mozRTCPeerConnection ||\n      globalThis.webkitRTCPeerConnection,\n    RTCSessionDescription: globalThis.RTCSessionDescription ||\n      globalThis.mozRTCSessionDescription || globalThis.webkitRTCSessionDescription,\n    RTCIceCandidate: globalThis.RTCIceCandidate || globalThis.mozRTCIceCandidate ||\n      globalThis.webkitRTCIceCandidate\n  }\n  if (!wrtc.RTCPeerConnection) return null\n  return wrtc\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvZ2V0LWJyb3dzZXItcnRjL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZGlzY29yZC1jbG9uZS1jbGllbnQvLi9ub2RlX21vZHVsZXMvZ2V0LWJyb3dzZXItcnRjL2luZGV4LmpzPzg5ZTkiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gb3JpZ2luYWxseSBwdWxsZWQgb3V0IG9mIHNpbXBsZS1wZWVyXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2V0QnJvd3NlclJUQyAoKSB7XG4gIGlmICh0eXBlb2YgZ2xvYmFsVGhpcyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBudWxsXG4gIHZhciB3cnRjID0ge1xuICAgIFJUQ1BlZXJDb25uZWN0aW9uOiBnbG9iYWxUaGlzLlJUQ1BlZXJDb25uZWN0aW9uIHx8IGdsb2JhbFRoaXMubW96UlRDUGVlckNvbm5lY3Rpb24gfHxcbiAgICAgIGdsb2JhbFRoaXMud2Via2l0UlRDUGVlckNvbm5lY3Rpb24sXG4gICAgUlRDU2Vzc2lvbkRlc2NyaXB0aW9uOiBnbG9iYWxUaGlzLlJUQ1Nlc3Npb25EZXNjcmlwdGlvbiB8fFxuICAgICAgZ2xvYmFsVGhpcy5tb3pSVENTZXNzaW9uRGVzY3JpcHRpb24gfHwgZ2xvYmFsVGhpcy53ZWJraXRSVENTZXNzaW9uRGVzY3JpcHRpb24sXG4gICAgUlRDSWNlQ2FuZGlkYXRlOiBnbG9iYWxUaGlzLlJUQ0ljZUNhbmRpZGF0ZSB8fCBnbG9iYWxUaGlzLm1velJUQ0ljZUNhbmRpZGF0ZSB8fFxuICAgICAgZ2xvYmFsVGhpcy53ZWJraXRSVENJY2VDYW5kaWRhdGVcbiAgfVxuICBpZiAoIXdydGMuUlRDUGVlckNvbm5lY3Rpb24pIHJldHVybiBudWxsXG4gIHJldHVybiB3cnRjXG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/get-browser-rtc/index.js\n");

/***/ })

};
;