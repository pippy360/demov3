//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####
//global vars

var g_drawingOptions = {
    generateTriangleResultList: false,
    drawUiOverlay: true,
    drawKeypoints: false,
    drawTriangles: true,
    forceApplyTransformations: false,
    drawImageOutline: true,
    drawInteractiveCanvasUiLayer: true
};

//
// consts
//

const MAX_TRIANGLES_DRAW = 800;//max number of triangles to draw per layer
//FIXME: fix hardcoded values
const TARGET_TRIANGLE_SCALE = {
    x: 160,
    y: 160
};

const INTERACTIVE_CANVAS_ID = "queryImageCanvasImageContent";
const INTERACTIVE_CANVAS_OVERLAY_ID = "queryImageCanvasUiOverlay";
const INTERACTIVE_CANVAS_IMAGE_OUTLINE_ID = "queryImageCanvasImageOutline";
const INTERACTIVE_FRAGMENT_CANVAS_ID = "fragmentCanvas1";
const INTERACTIVE_HIGHLIGHTED_CANVAS_ID = "queryImageCanvasHighlightedTriangle";

const REFERENCE_CANVAS_ID = "databaseImageCanvasImageContent";
const REFERENCE_CANVAS_OVERLAY_ID = "databaseImageCanvasUiOverlay";
const REFERENCE_CANVAS_IMAGE_OUTLINE_ID = "databaseImageCanvasImageOutline";
const REFERENCE_FRAGMENT_CANVAS_ID = "fragmentCanvas2";
const REFERENCE_HIGHLIGHTED_CANVAS_ID = "databaseImageCanvasHighlightedTriangle";

var g_numberOfKeypoints = 52;
const MIN_CROPPING_POLYGON_AREA = 600;

const ORANGE_COLOUR = [255, 87, 34];
const BLUE_COLOUR = [33, 150, 243];
var setAlpha = false;
function newStep(minPntDist, maxPntDist, minTriArea, colour) {
    return {
        minPntDist: minPntDist,
        maxPntDist: maxPntDist,
        minTriArea: minTriArea,
        colour: ORANGE_COLOUR
    }
}

const g_steps = [
    newStep(50, 450, 30, [100, 255, 100])
];

//
// globalState
//

function buildRect(x2, y2) {
    return [
        {x: 0, y: 0},
        {x: x2, y: 0},
        {x: x2, y: y2},
        {x: 0, y: y2}
    ]

}

function buildRectangularCroppingPolyFromLayer(layer) {
    return [
        {x: 0, y: 0},
        {x: layer.image.width, y: 0},
        {x: layer.image.width, y: layer.image.height},
        {x: 0, y: layer.image.height}
    ]

}

function newLayer(layerImage, keypoints, colour) {
    return {
        //TODO FIXME: FILL THIS IN
        nonTransformedImageOutline: buildRect(layerImage.width, layerImage.height),
        image: layerImage,
        appliedTransformations: getIdentityMatrix(),
        visible: true,
        layerColour: [0, 0, 0], //used for canvas UI overlay elements
        keypoints: keypoints,
        colour: colour//used for UI elements
    };
}

function newCanvasState() {
    return {
        //TODO: FIXME: FILL THIS IN
    };
}

var _g_preloadImage = null;

var g_globalState = null;
function newGlobalState() {
    return {
        activeCanvas: null,
        referenceCanvasState: null,
        interactiveCanvasState: null,
        isMouseDownAndClickedOnCanvas: null,
        temporaryAppliedTransformations: null,
        transformationMatBeforeTemporaryTransformations: null,
        pageMouseDownPosition: null,
    };
}

function reset() {
    console.log("Reset called.");
    //TODO: FIXME
}

var enum_TransformationOperation = {
    TRANSLATE: 1,
    UNIFORM_SCALE: 2,
    NON_UNIFORM_SCALE: 3,
    ROTATE: 4,
    CROP: 5
};

//
// getters
//

function getInteractiveCanvas() {
    return g_interactiveCanvas;
}

function getReferenceCanvas() {
    return g_referenceCanvas;
}

function toggleDrawUIOverlayMode() {
    g_shouldDrawUIOverlay = !g_shouldDrawUIOverlay;
    draw();
}


function applyTransformationToImageOutline(imageOutline, appliedTransformations) {
    return applyTransformationMatrixToAllKeypointsObjects(imageOutline, appliedTransformations);
}

function getIdentityTransformations() {
    var ret = {
        transformationCenterPoint: {
            x: 0,
            y: 0
        },
        uniformScale: 1,
        directionalScaleMatrix: getIdentityMatrix(),
        rotation: 0,
        translate: {
            x: 0,
            y: 0
        }
    };
    return ret;
}

function wipeTemporaryAppliedTransformations() {
    g_globalState.temporaryAppliedTransformations = getIdentityTransformations();
}

function getActiveLayer(globalState) {
    return globalState.activeCanvas.activeLayer;
}

function getReferenceImageTransformations() {
    return g_referenceImageTransformation;
}

function getInteractiveImageTransformations() {
    return g_interactiveImageTransformation;
}

function getKeypoints() {
    return g_keypoints;
}


// #####  ####### ######  #     # ####### ######
//#     # #       #     # #     # #       #     #
//#       #       #     # #     # #       #     #
// #####  #####   ######  #     # #####   ######
//      # #       #   #    #   #  #       #   #
//#     # #       #    #    # #   #       #    #
// #####  ####### #     #    #    ####### #     #
//server


function callSearch() {
    var interactiveCanvasContext = document.getElementById('interactiveCanvas');
    var image1 = interactiveCanvasContext.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
    var referenceCanvasContext = document.getElementById('referenceCanvas');
    var image2 = referenceCanvasContext.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.

    var regex = /^data:.+\/(.+);base64,(.*)$/;

    var matches;
    matches = image1.match(regex);
    var data1 = matches[2];
    matches = image2.match(regex);
    var data2 = matches[2];

    var info = {
        'image1': {
            'imageData': data1,
            'keypoints': g_cachedCalculatedInteractiveCanvasKeypoints
        },
        'image2': {
            'imageData': data2,
            'keypoints': g_cachedCalculatedReferenceCanvasKeypoints
        }
    };

    $("#searchResultsOutputDiv").html("loading...");

    $.ajax({
        url: 'http://104.197.137.79/runTestWithJsonData',
        type: 'POST',
        data: JSON.stringify(info),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function (msg) {
            console.log(msg);
            $("#searchResultsOutputDiv").html("Found this many matches: " + msg);
        },
        error: function (msg) {

        }
    });
}

// ######  #     #    #     #####  #     #
// #     # #     #   # #   #     # #     #
// #     # #     #  #   #  #       #     #
// ######  ####### #     #  #####  #######
// #       #     # #######       # #     #
// #       #     # #     # #     # #     #
// #       #     # #     #  #####  #     #
//phash

// Credit goes to:
// https://raw.githubusercontent.com/naptha/phash.js/master/phash.js

// https://ironchef-team21.googlecode.com/git-history/75856e07bb89645d0e56820d6e79f8219a06bfb7/ironchef_team21/src/ImagePHash.java

function pHash(img) {
    var size = 32,
        smallerSize = 8;

    var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');

    //document.body.appendChild(canvas)

    /* 1. Reduce size.
     * Like Average Hash, pHash starts with a small image.
     * However, the image is larger than 8x8; 32x32 is a good size.
     * This is really done to simplify the DCT computation and not
     * because it is needed to reduce the high frequencies.
     */

    canvas.width = size;
    canvas.height = size;
    // ctx.drawImage(img, 0, 0, size, size);
    ctx.drawImage(img, 0, -size, size, size * 3);
    var im = ctx.getImageData(0, 0, size, size);

    /* 2. Reduce color.
     * The image is reduced to a grayscale just to further simplify
     * the number of computations.
     */

    var vals = new Float64Array(size * size);
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var base = 4 * (size * i + j);
            vals[size * i + j] = 0.299 * im.data[base] +
                0.587 * im.data[base + 1] +
                0.114 * im.data[base + 2];
        }
    }

    /* 3. Compute the DCT.
     * The DCT separates the image into a collection of frequencies
     * and scalars. While JPEG uses an 8x8 DCT, this algorithm uses
     * a 32x32 DCT.
     */

    function applyDCT2(N, f) {
        // initialize coefficients
        var c = new Float64Array(N);
        for (var i = 1; i < N; i++) c[i] = 1;
        c[0] = 1 / Math.sqrt(2);

        // output goes here
        var F = new Float64Array(N * N);

        // construct a lookup table, because it's O(n^4)
        var entries = (2 * N) * (N - 1);
        var COS = new Float64Array(entries);
        for (var i = 0; i < entries; i++)
            COS[i] = Math.cos(i / (2 * N) * Math.PI);

        // the core loop inside a loop inside a loop...
        for (var u = 0; u < N; u++) {
            for (var v = 0; v < N; v++) {
                var sum = 0;
                for (var i = 0; i < N; i++) {
                    for (var j = 0; j < N; j++) {
                        sum += COS[(2 * i + 1) * u]
                            * COS[(2 * j + 1) * v]
                            * f[N * i + j];
                    }
                }
                sum *= ((c[u] * c[v]) / 4);
                F[N * u + v] = sum;
            }
        }
        return F
    }

    var dctVals = applyDCT2(size, vals);

    // for(var x = 0; x < size; x++){
    // 	for(var y = 0; y < size; y++){
    // 		ctx.fillStyle = (dctVals[size * x + y] > 0) ? 'white' : 'black';
    // 		ctx.fillRect(x, y, 1, 1)
    // 	}
    // }
    /* 4. Reduce the DCT.
     * This is the magic step. While the DCT is 32x32, just keep the
     * top-left 8x8. Those represent the lowest frequencies in the
     * picture.
     */

    var vals = []
    for (var x = 1; x <= smallerSize; x++) {
        for (var y = 1; y <= smallerSize; y++) {
            vals.push(dctVals[size * x + y])
        }
    }

    /* 5. Compute the average value.
     * Like the Average Hash, compute the mean DCT value (using only
     * the 8x8 DCT low-frequency values and excluding the first term
     * since the DC coefficient can be significantly different from
     * the other values and will throw off the average).
     */

    var median = vals.slice(0).sort(function (a, b) {
        return a - b
    })[Math.floor(vals.length / 2)];

    /* 6. Further reduce the DCT.
     * This is the magic step. Set the 64 hash bits to 0 or 1
     * depending on whether each of the 64 DCT values is above or
     * below the average value. The result doesn't tell us the
     * actual low frequencies; it just tells us the very-rough
     * relative scale of the frequencies to the mean. The result
     * will not vary as long as the overall structure of the image
     * remains the same; this can survive gamma and color histogram
     * adjustments without a problem.
     */

    return vals.map(function (e) {
        return e > median ? '1' : '0';
    }).join('');
}


function distance(a, b) {
    var dist = 0;
    for (var i = 0; i < a.length; i++)
        if (a[i] != b[i]) dist++;
    return dist;
}


// #     #
// ##   ##   ##   ##### #    #
// # # # #  #  #    #   #    #
// #  #  # #    #   #   ######
// #     # ######   #   #    #
// #     # #    #   #   #    #
// #     # #    #   #   #    #
//math

function calcPolygonArea(vertices) {
    var total = 0;

    for (var i = 0, l = vertices.length; i < l; i++) {
        var addX = vertices[i].x;
        var addY = vertices[i == vertices.length - 1 ? 0 : i + 1].y;
        var subX = vertices[i == vertices.length - 1 ? 0 : i + 1].x;
        var subY = vertices[i].y;

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }

    return Math.abs(total);
}

function getArea(tri) {
    var a = tri[0];
    var b = tri[1];
    var c = tri[2];
    var one = (a.x - c.x) * (b.y - a.y);
    var two = (a.x - b.x) * (c.y - a.y);
    var area = Math.abs(one - two) * 0.5;
    return area;
}

function getScaleMatrix(scaleX, scaleY) {
    return [[scaleX, 0, 0], [0, scaleY, 0], [0, 0, 1]];
}

function getTargetTriangleRotated180() {
    var targetTriangle = [
        {x: TARGET_TRIANGLE_SCALE.x, y: TARGET_TRIANGLE_SCALE.y},
        {x: .5 * TARGET_TRIANGLE_SCALE.x, y: 0},
        {x: 0, y: TARGET_TRIANGLE_SCALE.y}
    ];
    return targetTriangle;
}

function getTargetTriangle() {
    var targetTriangle = [
        {x: 0, y: 0},
        {x: .5 * TARGET_TRIANGLE_SCALE.x, y: 1 * TARGET_TRIANGLE_SCALE.y},
        {x: 1 * TARGET_TRIANGLE_SCALE.x, y: 0}
    ];
    return targetTriangle;
}

function calcTransformationMatrixToEquilateralTriangle(inputTriangle) {
    /*
     * ######CODE BY ROSCA#######
     */
    var targetTriangle = getTargetTriangle();
    var pt1 = targetTriangle[1];
    var pt2 = targetTriangle[2];
    var targetTriangleMat = [
        [pt1.x, pt2.x, 0.0],
        [pt1.y, pt2.y, 0.0],
        [0.0, 0.0, 1.0]
    ];
    var pt0 = inputTriangle[0];
    pt1 = inputTriangle[1];
    pt2 = inputTriangle[2];
    var inputTriangleMat = [
        [pt1.x - pt0.x, pt2.x - pt0.x, 0.0],
        [pt1.y - pt0.y, pt2.y - pt0.y, 0.0],
        [0.0, 0.0, 1.0]
    ];
    //move to 0,0
    //move to 0,0
    var tranlateMat = [
        [1.0, 0.0, -pt0.x],
        [0.0, 1.0, -pt0.y],
        [0.0, 0.0, 1.0]
    ];
    var result = getIdentityMatrix();
    result = matrixMultiply(result, targetTriangleMat);
    result = matrixMultiply(result, math.inv(inputTriangleMat));
    result = matrixMultiply(result, tranlateMat);
    return result
}

function getDirectionalScaleMatrix(scaleX, scaleY, direction) {
    var ret = getIdentityMatrix();
    ret = matrixMultiply(ret, getRotatoinMatrix(direction));
    ret = matrixMultiply(ret, getScaleMatrix(scaleX, scaleY));
    ret = matrixMultiply(ret, getRotatoinMatrix(-direction));
    return ret;
}

function getRotatoinMatrix(inRotation) {
    var toRads = inRotation * Math.PI / 180.0;
    return [
        [Math.cos(toRads), -Math.sin(toRads), 0],
        [Math.sin(toRads), Math.cos(toRads), 0],
        [0, 0, 1]
    ];
}

function getTranslateMatrix(x, y) {
    return [
        [1, 0, x],
        [0, 1, y],
        [0, 0, 1]
    ];
}

function getIdentityMatrix() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

//a = [1,0,0], b = [[1],[0],[0]]
//[1,0,0]*[[1],[0],[0]] = [1]
function matrixMultiply(a, b) {
    var aNumRows = a.length, aNumCols = a[0].length,
        bNumRows = b.length, bNumCols = b[0].length,
        m = new Array(aNumRows);  // initialize array of rows
    for (var r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols); // initialize the current row
        for (var c = 0; c < bNumCols; ++c) {
            m[r][c] = 0;             // initialize the current cell
            for (var i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }
    return m;
}

function convertSingleKeypointToMatrix(keypoint) {
    return [[keypoint.x], [keypoint.y], [1]];
}

function convertKeypointsToMatrixKeypoints(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var newKeypoint = convertSingleKeypointToMatrix(keypoints[i]);
        ret.push(newKeypoint);
    }
    return ret;
}

function convertTransformationObjectToTransformationMatrix(transformations) {
    var transformationCenterPoint = transformations.transformationCenterPoint;
    var ret = getIdentityMatrix();

    //Translate
    ret = matrixMultiply(ret, getTranslateMatrix(-transformations.translate.x, -transformations.translate.y));

    ret = matrixMultiply(ret, getTranslateMatrix(transformationCenterPoint.x, transformationCenterPoint.y));

    ret = matrixMultiply(ret, getScaleMatrix(transformations.uniformScale, transformations.uniformScale));

    //Rotate
    ret = matrixMultiply(ret, getTranslateMatrix(-transformations.translate.x, -transformations.translate.y));

    ret = matrixMultiply(ret, getRotatoinMatrix(-transformations.rotation));

    ret = matrixMultiply(ret, getTranslateMatrix(transformations.translate.x, transformations.translate.y));

    //Scale
    ret = matrixMultiply(ret, transformations.directionalScaleMatrix);

    ret = matrixMultiply(ret, getTranslateMatrix(-transformationCenterPoint.x, -transformationCenterPoint.y));

    return ret;
}

function applyTransformationMatToSingleKeypoint(keypoint, transformationMat) {
    return matrixMultiply(transformationMat, keypoint);
}

function applyTransformationMatrixToAllKeypoints(keypoints, transformationMat) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var transformedKeypoint = applyTransformationMatToSingleKeypoint(keypoints[i], transformationMat);
        ret.push(transformedKeypoint);
    }
    return ret;
}

function applyTransformationMatrixToAllKeypointsObjects(keypoints, transformationMat) {
    var keypointsToken1 = convertKeypointsToMatrixKeypoints(keypoints);
    var keypointsToken2 = applyTransformationMatrixToAllKeypoints(keypointsToken1, transformationMat);
    var keypointsToken3 = convertMatrixKeypointsToKeypointObjects(keypointsToken2);
    return keypointsToken3;
}

function convertSingleMatrixKeypoinToKeypointObject(arrayKeypoint) {
    return {
        x: (arrayKeypoint[0][0] == undefined) ? arrayKeypoint[0] : arrayKeypoint[0][0],
        y: (arrayKeypoint[1][0] == undefined) ? arrayKeypoint[1] : arrayKeypoint[1][0],
    };
}

function convertMatrixKeypointsToKeypointObjects(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        ret.push(convertSingleMatrixKeypoinToKeypointObject(keypoints[i]))
    }
    return ret;
}

function computeTransformedKeypoints(keypoints, transformationMat) {
    //turn the keypoints into arrays with an extra 1 at the end. {x: 2, y: 3} ---> [[2],[3],[1]]
    var newKeypoints = convertKeypointsToMatrixKeypoints(keypoints);

    //then mult each keypoint
    var finalArrayKeypoints = applyTransformationMatrixToAllKeypoints(newKeypoints, transformationMat);

    //convert back to keypoint objects
    var finalKeypoints = convertMatrixKeypointsToKeypointObjects(finalArrayKeypoints);

    return finalKeypoints;
}

function addTwoPoints(point1, point2) {
    return {
        x: point1.x + point2.x,
        y: point1.y + point2.y
    }
}

function minusTwoPoints(point1, point2) {
    return {
        x: point1.x - point2.x,
        y: point1.y - point2.y
    }
}

function generateRandomKeypoints(imageSize, numberOfKeypoints) {

    var ret = [];
    for (var i = 0; i < numberOfKeypoints; i++) {

        var x = Math.floor((Math.random() * imageSize.width));
        var y = Math.floor((Math.random() * imageSize.height));
        var kp = {
            x: x,
            y: y
        };
        ret.push(kp)
    }
    return ret;
}

function applyTransformationMatToSingleTriangle(triangle, transformationMatrix) {
    var transformedTriangle = [];
    for (var i = 0; i < triangle.length; i++) {
        var tempKeypoint1 = convertSingleKeypointToMatrix(triangle[i]);
        var tempKeypoint2 = applyTransformationMatToSingleKeypoint(tempKeypoint1, transformationMatrix);
        var tempKeypoint3 = convertSingleMatrixKeypoinToKeypointObject(tempKeypoint2);
        transformedTriangle.push(tempKeypoint3);
    }
    return transformedTriangle;
}

function applyTransformationToTriangles(triangles, transformationMatrix) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var currentTriangle = triangles[i];
        var temp = applyTransformationMatToSingleTriangle(currentTriangle, transformationMatrix);
        ret.push(temp);
    }
    return ret;
}

function getEuclideanDistance(point1, point2) {
    var a = point1.x - point2.x;
    var b = point1.y - point2.y;

    return Math.sqrt(a * a + b * b);
}

function filterValidPoints(headPoint, tailcombs, maxPntDist, minPntDist) {
    var ret = [];
    for (var i = 0; i < tailcombs.length; i++) {
        var currPt = tailcombs[i];
        var dist = getEuclideanDistance(currPt, headPoint);
        if (dist < maxPntDist && dist > minPntDist) {
            ret.push([currPt]);
        }
    }
    return ret;
}

function computeTriangles(inKeypoints, maxPntDist, minPntDist, minTriArea) {
    var ret = [];
    for (var i = 0; i < inKeypoints.length - 2; i++) {
        var keypoint = inKeypoints[i];
        var tail = inKeypoints.slice(i + 1);
        var subsetOfValidPoints = filterValidPoints(keypoint, tail, maxPntDist, minPntDist);
        var combs = k_combinations(subsetOfValidPoints, 2);
        for (var j = 0; j < combs.length; j++) {
            var currComb = combs[j];
            var tempTriangle = [keypoint, currComb[0][0], currComb[1][0]];
            if (getArea(tempTriangle) < minTriArea) {
                //invalid triangle ignore
                continue;
            }
            ret.push(tempTriangle);
        }
    }
    return ret;
}

function k_combinations(set, k) {
    var i, j, combs, head, tailcombs;

    // There is no way to take e.g. sets of 5 elements from
    // a set of 4.
    if (k > set.length || k <= 0) {
        return [];
    }

    // K-sized set has only one K-sized subset.
    if (k == set.length) {
        return [set];
    }

    // There is N 1-sized subsets in a N-sized set.
    if (k == 1) {
        combs = [];
        for (i = 0; i < set.length; i++) {
            combs.push([set[i]]);
        }
        return combs;
    }

    // Assert {1 < k < set.length}

    // Algorithm description:
    // To get k-combinations of a set, we want to join each element
    // with all (k-1)-combinations of the other elements. The set of
    // these k-sized sets would be the desired result. However, as we
    // represent sets with lists, we need to take duplicates into
    // account. To avoid producing duplicates and also unnecessary
    // computing, we use the following approach: each element i
    // divides the list into three: the preceding elements, the
    // current element i, and the subsequent elements. For the first
    // element, the list of preceding elements is empty. For element i,
    // we compute the (k-1)-computations of the subsequent elements,
    // join each with the element i, and store the joined to the set of
    // computed k-combinations. We do not need to take the preceding
    // elements into account, because they have already been the i:th
    // element so they are already computed and stored. When the length
    // of the subsequent list drops below (k-1), we cannot find any
    // (k-1)-combs, hence the upper limit for the iteration:
    combs = [];
    for (i = 0; i < set.length - k + 1; i++) {
        // head is a list that includes only our current element.
        head = set.slice(i, i + 1);
        // We take smaller combinations from the subsequent elements
        tailcombs = k_combinations(set.slice(i + 1), k - 1);
        // For each (k-1)-combination we join it with the current
        // and store it to the set of k-combinations.
        for (j = 0; j < tailcombs.length; j++) {
            combs.push(head.concat(tailcombs[j]));
        }
    }
    return combs;
}

// #####
// #     # #####    ##   #    #
// #     # #    #  #  #  #    #
// #     # #    # #    # #    #
// #     # #####  ###### # ## #
// #     # #   #  #    # ##  ##
// #####   #    # #    # #    #
//draw

function drawFragment(baseCanvas, fragmentCanvasContext, fragmentTriangle) {
    fragmentCanvasContext.save();
    paintCanvasWhite(fragmentCanvasContext);

    //rotate 180 degrees around image center
    fragmentCanvasContext.translate(fragmentCanvasContext.canvas.width / 2, fragmentCanvasContext.canvas.height / 2);
    fragmentCanvasContext.rotate(180.0 * Math.PI / 180);
    fragmentCanvasContext.translate(-fragmentCanvasContext.canvas.width / 2, -fragmentCanvasContext.canvas.height / 2);

    var mat = calcTransformationMatrixToEquilateralTriangle(fragmentTriangle);
    fragmentCanvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
    fragmentCanvasContext.drawImage(baseCanvas, 0, 0);
    fragmentCanvasContext.restore();
    fragmentCanvasContext.save();
    cropCanvasImage(fragmentCanvasContext, getTargetTriangleRotated180());
    fragmentCanvasContext.restore();
}

function highlightTriangle(layerIndex, triangleIndex) {

    $(".triangleTRAll").removeClass("selectedTriangleTR");
    $(".triangleTR" + layerIndex + "_" + triangleIndex).addClass("selectedTriangleTR");

    var layerTriangleMap = g_globalState.outputListState.triangleMapArray[layerIndex];
    var triangleStruct = layerTriangleMap.get(triangleIndex);

    var interactiveHighlightedCanvasContext = g_globalState.interactiveCanvasState.highlightedTriangleLayerCanvasContext;
    var referenceHighlightedCanvasContext = g_globalState.referenceCanvasState.highlightedTriangleLayerCanvasContext;

    //draw the outline of the triangle on the original canvas
    var enableFill = true;
    clearCanvasByContext(interactiveHighlightedCanvasContext);
    drawTriangleWithColour(interactiveHighlightedCanvasContext, triangleStruct.interactiveTriangle,
        [255, 255, 255], [24, 61, 78], enableFill);
    clearCanvasByContext(referenceHighlightedCanvasContext);
    drawTriangleWithColour(referenceHighlightedCanvasContext, triangleStruct.referenceTriangle,
        [255, 255, 255], [24, 61, 78], enableFill);


    //fill the fragment canvases
    var interactiveCanvas = g_globalState.interactiveCanvasState.imageLayerCanvas;
    var interactiveFragmentCanvasContext = g_globalState.interactiveCanvasState.fragmentCanvasContext;
    drawFragment(interactiveCanvas, interactiveFragmentCanvasContext, triangleStruct.interactiveTriangle);

    var referenceCanvas = g_globalState.referenceCanvasState.imageLayerCanvas;
    var referenceFragmentCanvasContext = g_globalState.referenceCanvasState.fragmentCanvasContext;
    drawFragment(referenceCanvas, referenceFragmentCanvasContext, triangleStruct.referenceTriangle);

    //Update pHash output
    var pHash1 = pHash(interactiveFragmentCanvasContext.canvas);
    var pHash2 = pHash(referenceFragmentCanvasContext.canvas);
    var pHashDistance = distance(pHash1, pHash2);
    $("#pHashDistanceOutputWrapper").html("" + pHashDistance + "");

}

function drawBackgroudImageWithTransformationMatrix(canvasContext, image, transformationMat) {
    canvasContext.save();
    var mat = transformationMat;
    canvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
    canvasContext.drawImage(image, 0, 0);
    canvasContext.restore();
}

function drawLineFromPointToMousePosition(ctx) {
    // ctx.save();
    // drawLine(mouseDownPoint, mouseCurrentPoint);
    // ctx.restore();
}

function drawTriangleWithColour(ctx, tri, strokeColour, fillColour, enableFill) {
    var alpha = .7;

    ctx.strokeStyle = 'rgba(' + strokeColour[0] + ', ' + strokeColour[1] + ' ,' + strokeColour[2] + ', ' + alpha + ')';
    //ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.beginPath();
    ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath();
    ctx.stroke();
    if (enableFill) {
        ctx.fillStyle = 'rgba(' + fillColour[0] + ', ' + fillColour[1] + ' ,' + fillColour[2] + ', ' + .9 + ')';
        ctx.fill();
    }
}

function drawKeypoints(interactiveCanvasContext, keypoints) {
    interactiveCanvasContext.closePath();

    for (var i = 0; i < keypoints.length; i++) {
        var currentKeypoint = keypoints[i];
        interactiveCanvasContext.beginPath();
        interactiveCanvasContext.arc(currentKeypoint.x,currentKeypoint.y,2,0,2*Math.PI);
        interactiveCanvasContext.stroke();
    }
    interactiveCanvasContext.stroke();
}

function drawTriangle(ctx, tri, colour) {
    drawTriangleWithColour(ctx, tri, colour, null/*fill colour*/, false/*enable fill*/);
}

function getColourForIndex(pointDistance) {
    for (var i = 0; i < g_steps.length; i++) {
        if (pointDistance > g_steps[i].minPntDist && pointDistance < g_steps[i].maxPntDist) {
            return g_steps[i].colour;
        }
    }
    console.log("Invalid colour/points distance")
    return [0, 0, 0];
}


function drawTriangles(canvasContext, triangles, colour) {
    canvasContext.beginPath();
    for (var i = 0; i < triangles.length; i++) {
        if (i >= MAX_TRIANGLES_DRAW) {
            break;
        }

        // var colour = getColourForIndex(getEuclideanDistance(triangles[i][0], triangles[i][1]));
        drawTriangle(canvasContext, triangles[i], colour);
    }
    canvasContext.stroke();
}

function drawClosingPolygon(ctx, inPoints, showFillEffect) {
    if (inPoints.length == 0) {
        return;
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.0)';
    ctx.beginPath();

    ctx.moveTo(0, 0);
    ctx.lineTo(0, 512);
    ctx.lineTo(512, 512);
    ctx.lineTo(512, 0);
    ctx.closePath();

    ctx.moveTo(inPoints[0].x, inPoints[0].y);
    for (var i = 1; i < inPoints.length; i++) {//i = 1 to skip first point
        var currentPoint = inPoints[i];
        ctx.lineTo(currentPoint.x, currentPoint.y);
    }
    ctx.closePath();

    //fill
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    if (showFillEffect) {
        ctx.fillStyle = 'rgba(242, 242, 242, 0.3)';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    }
    ctx.fill('evenodd'); //for firefox 31+, IE 11+, chrome
    //ctx.stroke();
};


function isPointInPolygon(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point.x, y = point.y;

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y;
        var xj = vs[j].x, yj = vs[j].y;

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};

function filterKeypointsOutsidePolygon(keypoints, coords) {
    if (coords.length == 0) {
        return keypoints;
    }

    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var keypoint = keypoints[i];
        if (isPointInPolygon(keypoint, coords)) {
            ret.push(keypoint);
        }
    }
    return ret;
}

function getTransformedCroppingPointsMatrix(croppingPoints, transformationMatrix) {
    var ret = [];
    for (var i = 0; i < croppingPoints.length; i++) {
        var point = croppingPoints[i];
        var point2 = convertSingleKeypointToMatrix(point);
        var transformedPoint = applyTransformationMatToSingleKeypoint(point2, transformationMatrix);
        var point3 = convertSingleMatrixKeypoinToKeypointObject(transformedPoint);
        ret.push(point3);
    }
    return ret;
}

function isAnyPointsOutsideCanvas(triangle, canvasDimensions) {
    for (var i = 0; i < triangle.length; i++) {
        var point = triangle[i];
        if (
            point.x > canvasDimensions.width ||
            point.x < 0 ||
            point.y > canvasDimensions.height ||
            point.y < 0) {
            //invalid triangle
            return true;
        }
    }
    return false;
}

function checkIfAllPointsInPolygon(triangle, croppingPointsPoly) {
    for (var i = 0; i < triangle.length; i++) {
        var point = triangle[i];
        if (!isPointInPolygon(point, croppingPointsPoly)) {
            return false;
        }
    }
    return true;
}

function isValidKeypoints(currentKeypoint, validKeypoints) {
    for (var i = 0; i < validKeypoints.length; i++) {
        var validKeypoint = validKeypoints[i];
        if (getEuclideanDistance(validKeypoint, currentKeypoint) < 1.0) {
            return true;
        }
    }
    return false;
}

function areAllKeypointsValid(triangle, validKeypoints) {
    for (var j = 0; j < triangle.length; j++) {
        var currentKeypoint = triangle[j];
        if (isValidKeypoints(currentKeypoint, validKeypoints)) {

        } else {
            return false;
        }
    }
    return true;
}

//Returns the filtered triangle along with the triangles previous index
function filterInvalidTriangles(triangles, validKeypoints, minPntDist, maxPntDist, minTriArea) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var triangle = triangles[i];

        if (!areAllKeypointsValid(triangle, validKeypoints)) {
            continue;
        }

        //FIXME: THIS TRIANGLE FILERING STUFF IS JUNK!!! FIX IT
        var d1 = getEuclideanDistance(triangle[0], triangle[1]);
        var d2 = getEuclideanDistance(triangle[0], triangle[2]);
        if (d1 > minPntDist
            && d1 < maxPntDist
            && d2 > minPntDist
            && d2 < maxPntDist
            && getArea(triangle) > minTriArea
        ) {
            ret.push({index: i, triangle: triangle});
        } else {
            //Invalid triangle, ignore
        }
    }
    return ret;
}

function getAllTrianglesFromIndexTriangleObjects(trianglesAndIndex) {
    var ret = [];
    for (var i = 0; i < trianglesAndIndex.length; i++) {
        ret.push(trianglesAndIndex[i].triangle);
    }
    return ret;
}

function containsMatchingPoint(tri, currPt) {
    for (var i = 0; i < tri.length; i++) {
        var comparePt = tri[i];
        if (comparePt.x == currPt.x && comparePt.y == currPt.y) {
            return true;
        }
    }
    return false;
}

function areAllPointsMatching(tri1, tri2) {
    for (var i = 0; i < tri1.length; i++) {
        var currPt = tri1[i];
        if (containsMatchingPoint(tri2, currPt)) {

        } else {
            //if any of the points don't match it's not a matching triangle
            return false;
        }
    }
    return true;
}

function containsMatchingTriangleWithIndexes(addedReferenceTrianglesWithIndex, refTri) {
    for (var i = 0; i < addedReferenceTrianglesWithIndex.length; i++) {
        var currTri = addedReferenceTrianglesWithIndex[i].triangle;
        if (areAllPointsMatching(refTri, currTri)) {
            return true;
        }
    }
    return false;
}

function containsMatchingTriangle(addedReferenceTriangles, refTri) {
    for (var i = 0; i < addedReferenceTriangles.length; i++) {
        var currTri = addedReferenceTriangles[i];
        if (areAllPointsMatching(refTri, currTri)) {
            return true;
        }
    }
    return false;
}

function getTableEntry(key, layerIndex, area) {
    //FIXME: i don't like these hardcoded strings
    var outputStrClass = "triangleTRAll " + "triangleTR" + layerIndex + "_" + key.value;
    var outputStr =
        "<tr class=\"" + outputStrClass + "\" onmouseover=\"highlightTriangle(" + layerIndex + ", " + key.value + ")\">" +
        "<td>" + key.value + "</td>" +
        "<td>" + Math.round(area) + " </td>" +
        "</tr>";
    return outputStr;
}

function paintCanvasWhite(canvasContext) {
    const canvas = canvasContext.canvas;
    canvasContext.fillStyle = "#FFFFFF";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height); // clear canvas
}

function filterInvalidTrianglesForAllSteps(triangles, validKeypoints) {
    var filteredReferenceImageTrianglesForAllSteps = [];
    for (var i = 0; i < g_steps.length; i++) {

        var currentStep = g_steps[i];
        var tempFilteredReferenceImageTriangles = filterInvalidTriangles(triangles,
            validKeypoints, currentStep.minPntDist, currentStep.maxPntDist, currentStep.minTriArea);

        //add all the triangles while avoiding adding duplicates

        for (var j = 0; j < tempFilteredReferenceImageTriangles.length; j++) {
            var currentTriangleWithindex = tempFilteredReferenceImageTriangles[j];
            if (containsMatchingTriangleWithIndexes(filteredReferenceImageTrianglesForAllSteps, currentTriangleWithindex.triangle)) {
                //ignore, don't add duplicates
            } else {
                filteredReferenceImageTrianglesForAllSteps.push(currentTriangleWithindex);
            }
        }
    }

    return filteredReferenceImageTrianglesForAllSteps;
}

function drawPolygonPath(ctx, inPoints) {

    ctx.moveTo(inPoints[0].x, inPoints[0].y);
    for (var i = 1; i < inPoints.length; i++) {//i = 1 to skip first point
        var currentPoint = inPoints[i];
        ctx.lineTo(currentPoint.x, currentPoint.y);
    }
    ctx.closePath();
}

function cropCanvasImage(ctx, inPoints) {

    if (inPoints.length == 0) {
        return;
    }
    ctx.beginPath();

    drawPolygonPath(ctx, inPoints);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.fill('evenodd');
}

function getTemporaryCanvasContext(canvasSize) {
    var tempCanvasElement = document.createElement('canvas');
    tempCanvasElement.width = canvasSize.width;
    tempCanvasElement.height = canvasSize.height;

    var ctx = tempCanvasElement.getContext("2d");
    return ctx;
}

function cropLayerImage(transformedImage, croppingPolygon) {

    var ctx = getTemporaryCanvasContext(transformedImage);
    ctx.drawImage(transformedImage, 0, 0);

    cropCanvasImage(ctx, croppingPolygon);
    return ctx.canvas;
}

function applyCroppingEffectToCanvas(ctx, inPoints) {
    if (inPoints.length == 0) {
        return;
    }
    ctx.beginPath();
    drawPolygonPath(ctx, buildRect(ctx.canvas.width, ctx.canvas.height));
    drawPolygonPath(ctx, inPoints);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill('evenodd');
}

function applyCroppingEffectToImage(canvasSize, transformedImage, croppingPolygon) {

    var ctx = getTemporaryCanvasContext(canvasSize);
    ctx.drawImage(transformedImage, 0, 0);

    applyCroppingEffectToCanvas(ctx, croppingPolygon);
    return ctx.canvas;
}

function drawImageOutlineWithLayer(canvasContext, layer) {
    var imageOutline = applyTransformationToImageOutline(layer.nonTransformedImageOutline, layer.appliedTransformations);
    drawLayerImageOutline(canvasContext, imageOutline);
}


function clearCanvasByContext(context) {
    var canvas = context.canvas;
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawImageOutlineInternal() {

    var referenceImageOutlineContext = g_globalState.referenceCanvasState.imageOutlineLayerCanvasContext;
    var referenceLayerUnderMouse = g_globalState.referenceCanvasState.imageOutlineHighlightLayer;
    clearCanvasByContext(referenceImageOutlineContext);
    if (referenceLayerUnderMouse != null && g_drawingOptions.drawImageOutline) {
        drawImageOutlineWithLayer(referenceImageOutlineContext, referenceLayerUnderMouse);
    }

    var interactiveImageOutlineContext = g_globalState.interactiveCanvasState.imageOutlineLayerCanvasContext;
    var interactiveLayerUnderMouse = g_globalState.interactiveCanvasState.imageOutlineHighlightLayer;
    clearCanvasByContext(interactiveImageOutlineContext);
    if (interactiveLayerUnderMouse != null && g_drawingOptions.drawImageOutline) {
        drawImageOutlineWithLayer(interactiveImageOutlineContext, interactiveLayerUnderMouse);
    }

    window.requestAnimationFrame(drawImageOutlineInternal);
}

function isKeypointOccluded(keypoint, layers) {
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];

        var imageOutline = applyTransformationToImageOutline(layer.nonTransformedImageOutline, layer.appliedTransformations)
        if (isPointInPolygon(keypoint, imageOutline)) {
            return true;
        }
    }
    return false;
}

function getNonOccludedKeypoints(keypoints, layers) {
    var result = [];

    for (var i = 0; i < keypoints.length; i++) {
        var keypoint = keypoints[i];
        if (isKeypointOccluded(keypoint, layers)) {
            //ignore occluded keypoints
        } else {
            result.push(keypoint);
        }
    }
    return result;
}

function drawUiLayer(canvasContext, keypoints, triangles, layerColour) {
    if (!setAlpha){
        drawKeypoints(canvasContext, keypoints);
    }
    drawTriangles(canvasContext, triangles, layerColour);
}

function drawLayerWithAppliedTransformations(canvasState, drawingLayer, dontCropImage) {

    const imageCanvasContext = canvasState.imageLayerCanvasContext;
    const uiCanvasContext = canvasState.uiLayerCanvasContext;

    var drawingImage;
    if (dontCropImage) {
        drawingImage = drawingLayer.layer.image;
    } else {
        drawingImage = cropLayerImage(drawingLayer.layer.image, drawingLayer.layer.nonTransformedImageOutline);
    }
    var transformationsMat = drawingLayer.layer.appliedTransformations;
    drawBackgroudImageWithTransformationMatrix(imageCanvasContext, drawingImage, transformationsMat);

    if (canvasState == g_globalState.interactiveCanvasState) {
        setAlpha = true;
    } else {
        setAlpha = false;
    }

    //drawUiLayer(uiCanvasContext, drawingLayer.transformedVisableKeypoints, drawingLayer.computedTriangles, drawingLayer.layer.colour);
}

function clearOutputListAndWipeCanvas() {
    $("#triangleListBody").html("");
    var c1 = g_globalState.interactiveCanvasState.highlightedTriangleLayerCanvasContext;
    var c2 = g_globalState.referenceCanvasState.highlightedTriangleLayerCanvasContext;
    clearCanvasByContext(c1);
    clearCanvasByContext(c2);
}

function generateOutputList(triangleMapArray) {
    var outputStr = "";

    for (var i = 0; i < triangleMapArray.length; i++) {
        var triangleMap = triangleMapArray[i];
        var keys = triangleMap.keys();
        for (var key = keys.next(); !key.done; key = keys.next()) { //iterate over keys
            var tri = triangleMap.get(key.value).referenceTriangle;
            var area = getArea(tri);
            outputStr = outputStr + getTableEntry(key, i, area);
        }
    }

    $("#triangleListBody").html(outputStr);
    $(".list-group-item").hover(function () {
            $(this).addClass("active");
        },
        function () {
            $(this).removeClass("active");
        });

    g_globalState.outputListState.triangleMapArray = triangleMapArray;
}


function drawCroppingEffect(canvasContext, imageOutline) {
    canvasContext.beginPath();
    drawPolygonPath(canvasContext, buildRect(canvasContext.canvas.width, canvasContext.canvas.height));
    drawPolygonPath(canvasContext, imageOutline);
    canvasContext.globalCompositeOperation = 'source-over';
    canvasContext.fillStyle = 'rgba(255, 255, 255, 0.5)';
    canvasContext.fill('evenodd');
}

var drawingLayer = {
    transformedVisableKeypoints: null,
}

function buildDrawingLayer(transformedVisableKeypoints, computedTriangles, layer) {
    return {
        layer: layer,
        transformedVisableKeypoints: transformedVisableKeypoints,
        computedTriangles: computedTriangles
    }
}

function filterPointsOutsideOfCanvas(keypoints, canvasDimensions) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var keypoint = keypoints[i];
        if (keypoint.x >= canvasDimensions.width
            || keypoint.x < 0
            || keypoint.y >= canvasDimensions.height
            || keypoint.y < 0) {
            //ignore this keypoint
        } else {
            ret.push(keypoint)
        }
    }
    return ret;
}

//FIXME: comment
function filterKeypoints(keypoints, transformedImageOutline, transformationsMat, layersOnTop, canvasDimensions) {

    var keypointsToken1 = applyTransformationMatrixToAllKeypointsObjects(keypoints, transformationsMat);
    var keypointsToken2 = filterKeypointsOutsidePolygon(keypointsToken1, transformedImageOutline);
    var keypointsToken3 = getNonOccludedKeypoints(keypointsToken2, layersOnTop);
    var keypointsToken4 = filterPointsOutsideOfCanvas(keypointsToken3, canvasDimensions);
    return keypointsToken4;
}

//FIXME: comment this function!!
function buildInteractiveCanvasDrawingLayers(canvasDimensions, layers) {

    var resultMap = new Map();
    var result = [];
    for (var i = 0; i < layers.length; i++) {
        var currentLayer = layers[i];

        var transformedImageOutline = applyTransformationToImageOutline(currentLayer.nonTransformedImageOutline, currentLayer.appliedTransformations);
        var layersOnTop = layers.slice(0, i);
        var filteredKeypoints = filterKeypoints(currentLayer.keypoints, transformedImageOutline, currentLayer.appliedTransformations, layersOnTop, canvasDimensions);

        //compute the triangles FIXME: extract to method
        var computedTrianglesForAllSteps = [];
        for (var j = 0; j < g_steps.length; j++) {
            var currentStep = g_steps[j];
            var tempTriangles = computeTriangles(filteredKeypoints, currentStep.maxPntDist, currentStep.minPntDist, currentStep.minTriArea);
            computedTrianglesForAllSteps = computedTrianglesForAllSteps.concat(tempTriangles);
            if(computedTrianglesForAllSteps.length > MAX_TRIANGLES_DRAW){
                break;
            }
        }

        var computedTrianglesForAllSteps = filteredTrianglesByImageOutlineIntersection(layersOnTop, computedTrianglesForAllSteps);

        const drawingLayer = buildDrawingLayer(filteredKeypoints, computedTrianglesForAllSteps, currentLayer);
        resultMap.set(currentLayer, drawingLayer);
        result.push(drawingLayer);
    }


    return [resultMap, result];
}

function _extractTriangles(filteredTrianglesWithIndex) {
    var result = [];
    for (var i = 0; i < filteredTrianglesWithIndex.length; i++) {
        result.push(filteredTrianglesWithIndex[i].triangle);
    }
    return result;
}

function getCenterPointOfPoly(arr) {
    var minX, maxX, minY, maxY;
    for(var i=0; i< arr.length; i++){
        minX = (arr[i].x < minX || minX == null) ? arr[i].x : minX;
        maxX = (arr[i].x > maxX || maxX == null) ? arr[i].x : maxX;
        minY = (arr[i].y < minY || minY == null) ? arr[i].y : minY;
        maxY = (arr[i].y > maxY || maxY == null) ? arr[i].y : maxY;
    }
    return [(minX + maxX) /2, (minY + maxY) /2];
}

function arrayToPolygonObject(shapeArray) {
    var arrayCenter = getCenterPointOfPoly(shapeArray);
    var result = new Polygon({x: arrayCenter[0], y: arrayCenter[1]}, "#0000FF");
    for (var i = 0; i < shapeArray.length; i++) {
        result.addAbsolutePoint(shapeArray[i]);
    }
    return result;
}

function triangleIntersectsPolygon(triangle, imageOutline) {
    var trianglePoly = arrayToPolygonObject(triangle);
    var imageOutlinePoly = arrayToPolygonObject(imageOutline);
    return trianglePoly.intersectsWith(imageOutlinePoly);
}

function triangleIntersectsLayers(triangle, layersOnTop) {
    for (var i = 0; i < layersOnTop.length; i++) {
        var currentLayer = layersOnTop[i];
        var imageOutline = applyTransformationToImageOutline(currentLayer.nonTransformedImageOutline, currentLayer.appliedTransformations);
        if (triangleIntersectsPolygon(triangle, imageOutline)){
            return true;
        }
    }
    return false;
}

function filteredTrianglesByImageOutlineIntersection(layersOnTop, filteredTrianglesWithIndex) {
    var result = [];
    for (var i = 0; i < filteredTrianglesWithIndex.length; i++) {
        var currentTriangle = filteredTrianglesWithIndex[i];
        if (triangleIntersectsLayers(currentTriangle, layersOnTop)){
            //filter
        } else {
            result.push(filteredTrianglesWithIndex[i]);
        }
    }
    return result;
}

function buildReferenceCanvasDrawingLayers(canvasDimensions, layers, drawingLayersByInteractiveImageLayer) {

    var result = [];
    var filteredTrianglesWithIndexInLayerArray = [];
    for (var i = 0; i < layers.length; i++) {
        var currentLayer = layers[i];

        var associatedLayer = currentLayer.associatedLayer;
        var transformationMat = math.inv(associatedLayer.appliedTransformations);
        var interactiveImageDrawingLayer = drawingLayersByInteractiveImageLayer.get(associatedLayer);
        var associatedLayerVisableKeypoints = applyTransformationMatrixToAllKeypointsObjects(interactiveImageDrawingLayer.transformedVisableKeypoints, transformationMat);
        var nonTransformedTriangles = applyTransformationToTriangles(interactiveImageDrawingLayer.computedTriangles, transformationMat);
        var transformedTriangles = applyTransformationToTriangles(nonTransformedTriangles, currentLayer.appliedTransformations);
        var transformedImageOutline = applyTransformationToImageOutline(currentLayer.nonTransformedImageOutline, currentLayer.appliedTransformations);
        var layersOnTop = layers.slice(0, i);
        var filteredKeypoints = filterKeypoints(associatedLayerVisableKeypoints, transformedImageOutline, currentLayer.appliedTransformations, layersOnTop, canvasDimensions);
        var filteredTrianglesWithIndex = filterInvalidTrianglesForAllSteps(transformedTriangles, filteredKeypoints);
        var filteredTriangles = _extractTriangles(filteredTrianglesWithIndex);
        result.push(buildDrawingLayer(filteredKeypoints, filteredTriangles, currentLayer));
        filteredTrianglesWithIndexInLayerArray.push({
            layer: currentLayer,
            trianglesWithIndex: filteredTrianglesWithIndex
        });
    }

    return [result, filteredTrianglesWithIndexInLayerArray];
}

function drawLayers(canvasState, drawingLayers) {
    var imageCanvasContext = canvasState.imageLayerCanvasContext;
    paintCanvasWhite(imageCanvasContext);
    var uiCanvasContext = canvasState.uiLayerCanvasContext;
    clearCanvasByContext(uiCanvasContext);

    //check if a cropping effect needs to be applied
    var isCrop = g_globalState.currentTranformationOperationState == enum_TransformationOperation.CROP;
    var isCroppingEffectActive = g_globalState.isMouseDownAndClickedOnCanvas && isCrop;


    for (var i = 0; i < drawingLayers.length; i++) {
        var idx = (drawingLayers.length - 1) - i;
        var drawingLayer = drawingLayers[idx];

        var isActiveCanvas = g_globalState.activeCanvas == canvasState;
        var isActiveLayer = canvasState.activeLayer == drawingLayer.layer;
        var dontCropImage = isActiveLayer && isCroppingEffectActive && isActiveCanvas;
        drawLayerWithAppliedTransformations(canvasState, drawingLayer, dontCropImage);
    }

    if (isCroppingEffectActive) {
        var appliedTransformations = g_globalState.activeCanvas.activeLayer.appliedTransformations;
        var imageOutlineToken1 = g_globalState.activeCanvas.activeLayer.nonTransformedImageOutline;
        var transformedImageOutline = applyTransformationToImageOutline(imageOutlineToken1, appliedTransformations);
        var canvasContext = g_globalState.activeCanvas.imageLayerCanvasContext;
        drawCroppingEffect(canvasContext, transformedImageOutline);
    }
}

//FIXME: this is really hacky
function buildInteractiveTriangleByReferenceTriangleMap(filteredTrianglesWithIndexInLayerArray, interactiveImageDrawingLayersByInteractiveImageLayer) {
    var interactiveTriangleByReferenceTriangleMapInLayerArray = [];
    for (var i = 0; i < filteredTrianglesWithIndexInLayerArray.length; i++) {
        var interactiveTriangleByReferenceTriangleMap = new Map();
        var currentLayer = filteredTrianglesWithIndexInLayerArray[i].layer;
        var associatedDrawingLayer = interactiveImageDrawingLayersByInteractiveImageLayer.get(currentLayer.associatedLayer)
        var trianglesWithindex = filteredTrianglesWithIndexInLayerArray[i].trianglesWithIndex;
        for (var j = 0; j < trianglesWithindex.length; j++) {
            var index = trianglesWithindex[j].index;
            var referenceTriangle = trianglesWithindex[j].triangle;
            var associatedTriangle = associatedDrawingLayer.computedTriangles[index];
            interactiveTriangleByReferenceTriangleMap.set(index, {
                referenceTriangle: referenceTriangle,
                interactiveTriangle: associatedTriangle
            });
        }
        interactiveTriangleByReferenceTriangleMapInLayerArray.push(interactiveTriangleByReferenceTriangleMap);
    }
    return interactiveTriangleByReferenceTriangleMapInLayerArray;
}

function draw() {

    var interactiveCanvasLayers = g_globalState.interactiveCanvasState.layers;
    var isInteractiveCanvasActive = g_globalState.activeCanvas == g_globalState.interactiveCanvasState;
    var tempRet = buildInteractiveCanvasDrawingLayers(g_globalState.activeCanvas.imageLayerCanvas, interactiveCanvasLayers);
    var interactiveImageDrawingLayersByInteractiveImageLayer = tempRet[0];
    var interactiveImageDrawingLayers = tempRet[1];
    drawLayers(g_globalState.interactiveCanvasState, interactiveImageDrawingLayers, isInteractiveCanvasActive);

    var referenceCanvasLayers = g_globalState.referenceCanvasState.layers;
    var isReferenceCanvasActive = g_globalState.activeCanvas == g_globalState.referenceCanvasState;
    var canvasDimensions = g_globalState.referenceCanvasState.imageLayerCanvasContext.canvas;

    var returnValueContainer = buildReferenceCanvasDrawingLayers(canvasDimensions, referenceCanvasLayers, interactiveImageDrawingLayersByInteractiveImageLayer);
    var referenceImageDrawingLayers = returnValueContainer[0];
    var filteredTrianglesWithIndexInLayerArray = returnValueContainer[1];

    var triangleMapByReferenceTriangleIndex = buildInteractiveTriangleByReferenceTriangleMap(filteredTrianglesWithIndexInLayerArray, interactiveImageDrawingLayersByInteractiveImageLayer);
    drawLayers(g_globalState.referenceCanvasState, referenceImageDrawingLayers, isReferenceCanvasActive);

    return triangleMapByReferenceTriangleIndex;
}

// #     #                         ###
// #     #  ####  ###### #####      #  #    # #####  #    # #####
// #     # #      #      #    #     #  ##   # #    # #    #   #
// #     #  ####  #####  #    #     #  # #  # #    # #    #   #
// #     #      # #      #####      #  #  # # #####  #    #   #
// #     # #    # #      #   #      #  #   ## #      #    #   #
//  #####   ####  ###### #    #    ### #    # #       ####    #
//user input

function changeCanvasSize(canvas, newWidth, newHeight) {
    canvas.width = newWidth;
    canvas.height = newHeight;
}

function changeCanvasSizeByState(canvasState, newWidth, newHeight) {
    changeCanvasSize(canvasState.uiLayerCanvas, newWidth, newHeight);
    changeCanvasSize(canvasState.imageLayerCanvas, newWidth, newHeight);
    changeCanvasSize(canvasState.imageOutlineLayerCanvas, newWidth, newHeight);
    changeCanvasSize(canvasState.highlightedTriangleLayerCanvas, newWidth, newHeight);
}

function changeReferenceCanvasSize(width, height) {
    changeCanvasSizeByState(g_globalState.referenceCanvasState, width, height);
    $(".referenceCanvasWrapper").width(width);
    $(".referenceCanvasWrapper").height(height);
    draw();
}

function changeInteractiveCanvasSize(width, height) {
    changeCanvasSizeByState(g_globalState.interactiveCanvasState, width, height);
    $(".interactiveCanvasWrapper").width(width);
    $(".interactiveCanvasWrapper").height(height);
    draw();
}


$(document).mousedown(function (e) {
    //ignore
});

$(document).mousemove(function (e) {
    if (g_globalState != null && g_globalState.isMouseDownAndClickedOnCanvas) {
        g_globalState.referenceImageHighlightedTriangle = null;
        g_globalState.activeCanvas.imageOutlineHighlightLayer = g_globalState.activeCanvas.activeLayer;
        handleMouseMoveOnDocument(e);
        draw();
        clearOutputListAndWipeCanvas();
    }
});

$(document).mouseup(function (e) {
    if (g_globalState != null && g_globalState.isMouseDownAndClickedOnCanvas) {
        handleMouseUp(e);
        g_globalState.isMouseDownAndClickedOnCanvas = false;

        //FIXME: finish this and extract to method
        var triangleMapArray = draw();
        generateOutputList(triangleMapArray);
    }
});

$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mousedown(function (e) {
    if (g_globalState == null) {
        return;
    }

    g_globalState.activeCanvas = g_globalState.interactiveCanvasState;

    e.preventDefault();
    g_globalState.isMouseDownAndClickedOnCanvas = true;
    handleMouseDownOnCanvas(e);
});

$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mousemove(function (e) {
    if (g_globalState == null) {
        return;
    }

    const layers = g_globalState.interactiveCanvasState.layers;
    const canvasContext = g_globalState.interactiveCanvasState.imageOutlineLayerCanvasContext;

    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    g_globalState.interactiveCanvasState.imageOutlineHighlightLayer = getActiveLayerWithCanvasPosition(canvasMousePosition, layers, null);

    if (g_globalState == null || g_globalState.activeCanvas != g_globalState.interactiveCanvasState) {
        return;
    }
    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    console.log(canvasMousePosition);

    if (g_globalState.isMouseDownAndClickedOnCanvas) {
        handleMouseMoveOnCanvas(e);
    }
});

$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mouseup(function (e) {
    if (g_globalState == null) {
        return;
    }
    //ignore
});

$("#" + REFERENCE_CANVAS_OVERLAY_ID).mousedown(function (e) {
    if (g_globalState == null) {
        return;
    }

    g_globalState.activeCanvas = g_globalState.referenceCanvasState;

    e.preventDefault();
    g_globalState.isMouseDownAndClickedOnCanvas = true;
    handleMouseDownOnCanvas(e);
});

$("#" + REFERENCE_CANVAS_OVERLAY_ID).mousemove(function (e) {
    if (g_globalState == null) {
        return;
    }

    const layers = g_globalState.referenceCanvasState.layers;
    const canvasContext = g_globalState.referenceCanvasState.imageOutlineLayerCanvasContext;

    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    g_globalState.referenceCanvasState.imageOutlineHighlightLayer = getActiveLayerWithCanvasPosition(canvasMousePosition, layers, null);

    if (g_globalState == null || g_globalState.activeCanvas != g_globalState.referenceCanvasState) {
        return;
    }

    if (g_globalState.isMouseDownAndClickedOnCanvas) {
        handleMouseMoveOnCanvas(e);
    }
});

$("#" + REFERENCE_CANVAS_OVERLAY_ID).mouseup(function (e) {
    if (g_globalState == null) {
        return;
    }
    //ignore
});

function getCurrentPageMousePosition(e) {
    return {
        x: e.pageX,
        y: e.pageY
    };
}

function getCurrentCanvasMousePosition(e) {
    if (e.offsetX || e.offsetX === 0) {
        return {
            x: e.offsetX,
            y: e.offsetY
        };
    } else if (e.layerX || e.offsetX === 0) {
        return {
            x: e.layerX,
            y: e.layerY
        };
    } else {
        console.log("Error: Invalid state");
    }

}

function filterPointsOutsideImage(imageOutline, imageDimensions) {
    var result = [];
    for (var i = 0; i < imageOutline.length; i++) {
        var point = imageOutline[i];
        var x = point.x, y = point.y;
        if (point.x < 0) {
            x = 0;
        }
        if (point.x > imageDimensions.width) {
            x = imageDimensions.width;
        }
        if (point.y < 0) {
            y = 0;
        }
        if (point.y > imageDimensions.height) {
            y = imageDimensions.height;
        }
        result.push({x: x, y: y});
    }
    return result;
}

function handleMouseUpCrop(mousePosition, activeLayer) {

    var imageOutline = activeLayer.nonTransformedImageOutline;
    var imageDimensions = {
        width: activeLayer.image.width,
        height: activeLayer.image.height
    };
    activeLayer.nonTransformedImageOutline = filterPointsOutsideImage(imageOutline, imageDimensions);

    var area = calcPolygonArea(activeLayer.nonTransformedImageOutline);
    if (area < MIN_CROPPING_POLYGON_AREA) {
        activeLayer.nonTransformedImageOutline = buildRectangularCroppingPolyFromLayer(activeLayer);
        activeLayer.croppingPolygonInverseMatrix = getIdentityMatrix();
    }
}

function handleMouseUp(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    var globalState = g_globalState;
    switch (g_globalState.currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            break;
        case enum_TransformationOperation.ROTATE:
            break;
        case enum_TransformationOperation.CROP:
            var activeLayer = g_globalState.activeCanvas.activeLayer;
            handleMouseUpCrop(canvasMousePosition, activeLayer);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }

    wipeTemporaryAppliedTransformations();
}


function handleMouseMoveTranslate(pageMouseDownPosition, pageMousePosition, globalState) {
    var translateDelta = minusTwoPoints(pageMouseDownPosition, pageMousePosition);
    globalState.temporaryAppliedTransformations.translate = translateDelta;
}

function handleMouseMoveNonUniformScale(pageMouseDownPosition, pageMousePosition, globalState) {
    var mouseDownPoint = pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    var extraRotation = Math.atan2(y, x) * (180.0 / Math.PI) * -1;
    if (extraRotation < 0) {
        extraRotation = (360 + (extraRotation));
    }
    direction = extraRotation % 360;
    scale = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    scale += 50;//skip all the fractions, 1 is the minimum scale
    scale /= 50;
    scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1 / Math.sqrt(scale), -direction);
    globalState.temporaryAppliedTransformations.directionalScaleMatrix = scaleMatrix;
}

function handleMouseMoveUniformScale(pageMouseDownPosition, pageMousePosition, globalState) {
    var mouseDownPoint = pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    // var x = (pageMousePosition.x - mouseDownPoint.x);

    scale = y;//(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));

    if (y > 0) {
        scale += 100;
        scale = 1 / (scale / 100);
    } else {
        scale *= -1;//make y positive
        scale += 100;
        scale /= 100;
    }

    globalState.temporaryAppliedTransformations.uniformScale = scale;
}

function handleMouseMoveRotate(pageMouseDownPosition, pageMousePosition, globalState) {
    var mouseDownPoint = pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    var extraRotation = Math.atan2(y, x) * (180.0 / Math.PI) * -1;
    if (extraRotation < 0) {
        extraRotation = (360 + (extraRotation));
    }
    extraRotation = extraRotation % 360;
    globalState.temporaryAppliedTransformations.rotation = extraRotation;
}

function handleMouseMoveCrop(mousePosition, activeLayer) {
    var invMat = math.inv(activeLayer.appliedTransformations);
    var keypointMat = convertSingleKeypointToMatrix(mousePosition);
    var transformedPointMat = applyTransformationMatToSingleKeypoint(keypointMat, invMat);
    var transformedPoint = convertSingleMatrixKeypoinToKeypointObject(transformedPointMat);
    activeLayer.nonTransformedImageOutline.push(transformedPoint);
}

function applyTemporaryTransformationsToActiveLayer() {
    var layer = getActiveLayer(g_globalState);
    var temporaryAppliedTransformationsMat = convertTransformationObjectToTransformationMatrix(g_globalState.temporaryAppliedTransformations);
    var savedLayerMat = g_globalState.transformationMatBeforeTemporaryTransformations;
    layer.appliedTransformations = matrixMultiply(temporaryAppliedTransformationsMat, savedLayerMat);
}

function handleMouseMoveOnDocument(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var globalState = g_globalState;
    switch (globalState.currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseMoveTranslate(globalState.pageMouseDownPosition, pageMousePosition, globalState);
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            handleMouseMoveNonUniformScale(globalState.pageMouseDownPosition, pageMousePosition, globalState);
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            handleMouseMoveUniformScale(globalState.pageMouseDownPosition, pageMousePosition, globalState);
            break;
        case enum_TransformationOperation.ROTATE:
            handleMouseMoveRotate(globalState.pageMouseDownPosition, pageMousePosition, globalState);
            break;
        case enum_TransformationOperation.CROP:
            //ignore, handled in canvas on mouse move function
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }

    applyTemporaryTransformationsToActiveLayer();
}

function drawLayerImageOutline(ctx, imageOutlinePolygon) {
    if (imageOutlinePolygon.length == 0) {
        return;
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.beginPath();

    ctx.moveTo(imageOutlinePolygon[0].x, imageOutlinePolygon[0].y);
    for (var i = 1; i < imageOutlinePolygon.length; i++) {//i = 1 to skip first point
        var currentPoint = imageOutlinePolygon[i];
        ctx.lineTo(currentPoint.x, currentPoint.y);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2196F3';
    ctx.stroke();
}

function handleMouseMoveOnCanvas(e) {
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_globalState.currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            //do nothing
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            //do nothing
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            //do nothing
            break;
        case enum_TransformationOperation.ROTATE:
            //do nothing
            break;
        case enum_TransformationOperation.CROP:
            var activeLayer = g_globalState.activeCanvas.activeLayer;
            handleMouseMoveCrop(canvasMousePosition, activeLayer);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }
}

function handleMouseDownCrop(activeLayer) {
    //The nonTransformedImageOutline is never allowed to be an empty list
    //so onMouseUp if the nonTransformedImageOutline is still empty then
    //it is replaced with the outline of the image with no cropping
    activeLayer.nonTransformedImageOutline = [];
}

function getActiveLayerWithCanvasPosition(canvasMousePosition, layers, noMatchReturnValue) {

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var imageOutline = applyTransformationToImageOutline(layer.nonTransformedImageOutline, layer.appliedTransformations);
        //take the cropping shape
        if (isPointInPolygon(canvasMousePosition, imageOutline)) {
            return layer;
        }
    }
    return noMatchReturnValue;

}

function handleMouseDownOnCanvas(e) {
    const pageMousePosition = getCurrentPageMousePosition(e);
    const canvasMousePosition = getCurrentCanvasMousePosition(e);

    g_globalState.pageMouseDownPosition = pageMousePosition;
    g_globalState.temporaryAppliedTransformations.transformationCenterPoint = canvasMousePosition;
    //FIXME: set the active canvas

    const currentActiveLayer = g_globalState.activeCanvas.activeLayer;
    const clickedActiveLayer = getActiveLayerWithCanvasPosition(canvasMousePosition, g_globalState.activeCanvas.layers, currentActiveLayer);
    g_globalState.activeCanvas.activeLayer = clickedActiveLayer;

    g_globalState.transformationMatBeforeTemporaryTransformations = clickedActiveLayer.appliedTransformations;

    switch (g_globalState.currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            //do nothing
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            //do nothing
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            //do nothing
            break;
        case enum_TransformationOperation.ROTATE:
            //do nothing
            break;
        case enum_TransformationOperation.CROP:
            handleMouseDownCrop(clickedActiveLayer);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }
}

function applyTransformationEffects(state) {
    if (state == enum_TransformationOperation.TRANSLATE) {
        $(".twoCanvasWrapper").addClass("move");
    } else {
        $(".twoCanvasWrapper").removeClass("move");
    }
}

function setCurrnetOperation(newState) {
    g_globalState.currentTranformationOperationState = newState;
    applyTransformationEffects(newState);
}

function buildCommonCanvasState(imageCanvasId, overlayCanvasId, imageOutlineCanvasId, fragmentCanvasId,
                                highlightedTriangleLayerId, preloadedImage) {
    var returnedCanvasState = newCanvasState();

    returnedCanvasState.uiLayerId = overlayCanvasId;
    returnedCanvasState.uiLayerCanvas = document.getElementById(overlayCanvasId);
    returnedCanvasState.uiLayerCanvasContext = document.getElementById(overlayCanvasId).getContext('2d');

    returnedCanvasState.imageLayerId = imageCanvasId;
    returnedCanvasState.imageLayerCanvas = document.getElementById(imageCanvasId);
    returnedCanvasState.imageLayerCanvasContext = document.getElementById(imageCanvasId).getContext('2d');

    returnedCanvasState.imageOutlineLayerId = imageOutlineCanvasId;
    returnedCanvasState.imageOutlineLayerCanvas = document.getElementById(imageOutlineCanvasId);
    returnedCanvasState.imageOutlineLayerCanvasContext = document.getElementById(imageOutlineCanvasId).getContext('2d');

    returnedCanvasState.highlightedTriangleLayerId = highlightedTriangleLayerId;
    returnedCanvasState.highlightedTriangleLayerCanvas = document.getElementById(highlightedTriangleLayerId);
    returnedCanvasState.highlightedTriangleLayerCanvasContext = document.getElementById(highlightedTriangleLayerId).getContext('2d');

    returnedCanvasState.fragmentCanvasId = fragmentCanvasId;
    returnedCanvasState.fragmentCanvas = document.getElementById(fragmentCanvasId);
    returnedCanvasState.fragmentCanvasContext = document.getElementById(fragmentCanvasId).getContext('2d');

    returnedCanvasState.imageOutlineHighlightLayer = null;//The layer with a blue outline around the image

    returnedCanvasState.layers = [];
    //FIXME: reference image layers done have keypoints, they are computed from the associated interactive image layer
    var keypoints = generateRandomKeypoints({
        width: preloadedImage.width,
        height: preloadedImage.height
    }, g_numberOfKeypoints)
    returnedCanvasState.layers.push(newLayer(preloadedImage, keypoints, BLUE_COLOUR));
    returnedCanvasState.activeLayer = returnedCanvasState.layers[0];
    return returnedCanvasState;
}

function buildReferenceCanvasState() {
    return buildCommonCanvasState(REFERENCE_CANVAS_ID, REFERENCE_CANVAS_OVERLAY_ID,
        REFERENCE_CANVAS_IMAGE_OUTLINE_ID, REFERENCE_FRAGMENT_CANVAS_ID, REFERENCE_HIGHLIGHTED_CANVAS_ID,
        _g_preloadImage);
}

function buildInteractiveCanvasState() {
    return buildCommonCanvasState(INTERACTIVE_CANVAS_ID, INTERACTIVE_CANVAS_OVERLAY_ID,
        INTERACTIVE_CANVAS_IMAGE_OUTLINE_ID, INTERACTIVE_FRAGMENT_CANVAS_ID, INTERACTIVE_HIGHLIGHTED_CANVAS_ID,
        _g_preloadImage);
}

function buildGlobalState() {
    var resultingGlobalState = newGlobalState();//TODO: FIXME:

    const referenceCanvasState = buildReferenceCanvasState();
    const interactiveCanvasState = buildInteractiveCanvasState();

    //FIXME: come up with a better way of handling associatedLayers 
    referenceCanvasState.layers[0].associatedLayer = interactiveCanvasState.layers[0];
    interactiveCanvasState.layers[0].associatedLayer = referenceCanvasState.layers[0];

    resultingGlobalState.activeCanvas = interactiveCanvasState;
    resultingGlobalState.referenceCanvasState = referenceCanvasState;
    resultingGlobalState.interactiveCanvasState = interactiveCanvasState;
    resultingGlobalState.isMouseDownAndClickedOnCanvas = false;
    resultingGlobalState.currentTranformationOperationState = enum_TransformationOperation.TRANSLATE;
    resultingGlobalState.temporaryAppliedTransformations = getIdentityTransformations();
    resultingGlobalState.pageMouseDownPosition = {x: 0, y: 0};

    resultingGlobalState.outputListState = {
        triangleMapArray: null
    };


    return resultingGlobalState;
}

function initAfterImageLoad() {
    g_globalState = buildGlobalState();
    setCurrnetOperation(enum_TransformationOperation.TRANSLATE);
    draw();
    window.requestAnimationFrame(drawImageOutlineInternal);
}

function loadImageAndInit(imageSrc) {
    _g_preloadImage = new Image();
    _g_preloadImage.src = imageSrc;
    _g_preloadImage.onload = function () {
        initAfterImageLoad();
    };
}

//fixme: remove this
function _debug_addlayer(imageSrc) {
    var image;
    image = new Image();
    image.src = imageSrc;
    image.onload = function () {
        var keypoints = generateRandomKeypoints({width: image.width, height: image.height}, g_numberOfKeypoints);
        var layer1 = newLayer(image, keypoints, ORANGE_COLOUR);
        var layer2 = newLayer(image, null, ORANGE_COLOUR);
        layer1.associatedLayer = layer2;
        layer2.associatedLayer = layer1;
        g_globalState.interactiveCanvasState.layers.push(layer1);
        g_globalState.referenceCanvasState.layers.push(layer2);
    };
}

var start = 0;
function animateStep(timestamp) {
    if (!start) start = timestamp;
    var progress = timestamp - start;
    temporaryAppliedTransformations.rotation = progress / 100 % 360;
    temporaryAppliedTransformations.uniformScale = progress / 100000 % 360;
    console.log(progress % 360);

    if (temporaryAppliedTransformations.uniformScale < 1) {
        window.requestAnimationFrame(animateStep);
    }
    g_skipListGen = true;
    g_forceApplyTransformations = true;
    draw();
    g_forceApplyTransformations = false;
    g_skipListGen = false;
}


function animate() {
    temporaryAppliedTransformations.transformationCenterPoint = {
        x: 280 / 2,
        y: 280 / 2
    };

    window.requestAnimationFrame(animateStep);
}

function init() {
    loadImageAndInit('images/kodaline.jpg');
}

init();

var animationStartTime;
var end = false;
var animationStartMatrix;
var mult = 1;


function animation7(frame) {
    var animationFrames = 60*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    g_globalState.temporaryAppliedTransformations.transformationCenterPoint = {x:140,y:140};
    g_globalState.temporaryAppliedTransformations.uniformScale = (5*percentageDone) + 1;
    var scale = (2*percentageDone)+1;;
    var scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1 / Math.sqrt(scale), 45);
    g_globalState.temporaryAppliedTransformations.directionalScaleMatrix = scaleMatrix;

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation6(frame) {
    var animationFrames = 60*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    g_globalState.temporaryAppliedTransformations.transformationCenterPoint = {x:140,y:140};
    g_globalState.temporaryAppliedTransformations.uniformScale = (1/(percentageDone*2 + 1));
    var scale = (2*percentageDone)+1;;
    var scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1 / Math.sqrt(scale), 45);
    g_globalState.temporaryAppliedTransformations.directionalScaleMatrix = scaleMatrix;

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation5(frame) {
    var animationFrames = 10*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    var endx = -20;
    var endy = 30;
    g_globalState.temporaryAppliedTransformations.translate = {
        x: -endx*percentageDone,
        y: -endy*percentageDone
    };

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation4(frame) {
    var animationFrames = 10*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    var endx = -50;
    var endy = -100;
    g_globalState.temporaryAppliedTransformations.translate = {
        x: -endx*percentageDone,
        y: -endy*percentageDone
    };

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation3(frame) {
    var animationFrames = 5*mult;//60*mult

    animationStart();

    var percentageDone = frame/animationFrames;
    var endx = 80;
    var endy = 80;
    g_globalState.temporaryAppliedTransformations.translate = {
        x: -endx*percentageDone,
        y: -endy*percentageDone
    };

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation2(frame) {
    var animationFrames = 20;//120*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    var endRotation = 120;
    g_globalState.temporaryAppliedTransformations.transformationCenterPoint = {x:140,y:140};
    g_globalState.temporaryAppliedTransformations.rotation = percentageDone * endRotation;
    var scale = (2*percentageDone)+1;
    var scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1 / Math.sqrt(scale), 45);
    g_globalState.temporaryAppliedTransformations.directionalScaleMatrix = scaleMatrix;

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animation1(frame) {
    var animationFrames = 20*mult;

    animationStart();

    var percentageDone = frame/animationFrames;
    var endx = 0;
    var endy = 0;
    g_globalState.temporaryAppliedTransformations.translate = {
        x: -endx*percentageDone,
        y: -endy*percentageDone
    };

    animationEnd(frame);
    return (frame >= animationFrames);
}

function animationStart() {
    g_globalState.activeCanvas.activeLayer = g_globalState.interactiveCanvasState.layers[0];
    g_globalState.transformationMatBeforeTemporaryTransformations = deepMatrixClone(animationStartMatrix);
    wipeTemporaryAppliedTransformations();
}

function deepMatrixClone(inputMat) {
    return[
        inputMat[0].slice(0),
        inputMat[1].slice(0),
        inputMat[2].slice(0),
    ];
}

var g_frame = 1;


function theDrawPart(g_frame) {
//        var canvas = document.createElement('canvas'),
//            ctx = canvas.getContext('2d');
//        canvas.width = 700;
//        canvas.height = 600;
    var canvas = document.getElementById('bigCanvas'),
        ctx = canvas.getContext('2d');
    paintCanvasWhite(ctx);

    var ctx1= document.getElementById('queryImageCanvasImageContent');
    var ctx2= document.getElementById('queryImageCanvasUiOverlay');
    var ctx3= document.getElementById('databaseImageCanvasImageContent');
    var ctx4= document.getElementById('databaseImageCanvasUiOverlay');

    ctx.drawImage(ctx1, 0, 0);
    ctx.drawImage(ctx2, 0, 0);
    ctx.drawImage(ctx3, 380, 0);
    ctx.drawImage(ctx4, 380, 0);

}


function drawAllImagesToCanvasAndSend(g_frame) {

//        var canvas = document.createElement('canvas'),
//            ctx = canvas.getContext('2d');
//        canvas.width = 700;
//        canvas.height = 600;
    var canvas = document.getElementById('bigCanvas'),
        ctx = canvas.getContext('2d');
    paintCanvasWhite(ctx);

    var ctx1= document.getElementById('queryImageCanvasImageContent');
    var ctx2= document.getElementById('queryImageCanvasUiOverlay');
    var ctx3= document.getElementById('databaseImageCanvasImageContent');
    var ctx4= document.getElementById('databaseImageCanvasUiOverlay');

    ctx.drawImage(ctx1, 10, 10);
    ctx.drawImage(ctx2, 10, 10);
    ctx.drawImage(ctx3, 310, 10);
    ctx.drawImage(ctx4, 310, 10);

//
//        var image1 = canvas.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
////
//        var regex = /^data:.+\/(.+);base64,(.*)$/;
//        var matches;
//        matches = image1.match(regex);
//        var data1 = matches[2];
//
//        var info = {
//            'image1': {
//                'imageData': data1,
//                'frameNumber': g_frame
//            }
//        };
//
//        $.ajax({
//            url: 'http://127.0.0.1/runTestWithJsonData',
//            type: 'POST',
//            data: JSON.stringify(info),
//            contentType: 'application/json; charset=utf-8',
//            dataType: 'json',
//            async: true,
//            success: function (msg) {
//                console.log(msg);
//            },
//            error: function (msg) {
//                console.log(msg);
//            }
//        });
}

function addToX(transformedShape2, number) {
    for (var i = 0; i < transformedShape2.length; i++) {
        transformedShape2[i].x += number;
    }
}

function addToY(transformedShape2, number) {
    for (var i = 0; i < transformedShape2.length; i++) {
        transformedShape2[i].y += number;
    }
}

function addToX2(transformedShape2, number) {
    var ret = [];
    for (var i = 0; i < transformedShape2.length; i++) {
        var newPt = {
            x: transformedShape2[i].x + number,
            y: transformedShape2[i].y
        };
        ret.push(newPt);
    }
    return ret;
}

function animationEnd(frame) {
    applyTemporaryTransformationsToActiveLayer();
    wipeTemporaryAppliedTransformations();
    drawAllImagesToCanvasAndSend(g_frame);

    var canvas = document.getElementById('bigCanvas'),
        ctx = canvas.getContext('2d');

    var trans = g_globalState.interactiveCanvasState.layers[0].appliedTransformations;
    var kp5 = g_globalState.interactiveCanvasState.layers[0].keypoints;
    ctx.strokeStyle = 'rgba(255,0,0,.03)';
    ctx.lineWidth = 1;
    var keypoints1 = [];
    var keypoints2 = [];
    var retVal = draw()[0];
    var keys = retVal.keys();

    var keysArr = [];
    var i = 0;
    for (var key = keys.next(), i = 0; !key.done; key = keys.next(), i++) { //iterate over keys
        keysArr.push(key);
    }

    var spacing = keysArr.length/100;
    if (spacing < 1) {
        spacing = 1;
    }
    for (var i = 0; i < keysArr.length; i += spacing) {
        key = keysArr[parseInt(i)];
        // if( i > 500)
        //     break;

        var tri = retVal.get(key.value);
        var tri1 = tri.referenceTriangle;
        var tri2 = tri.interactiveTriangle;
        var out = applyTransformationMatrixToAllKeypointsObjects(tri1, getTranslateMatrix(310, 10));

        drawTriangle(ctx, out, ORANGE_COLOUR);
    }


    var strokeColour = ORANGE_COLOUR;
    var alpha = .1;
    ctx.strokeStyle = 'rgba(' + strokeColour[0] + ', ' + strokeColour[1] + ' ,' + strokeColour[2] + ', ' + alpha + ')';


    for (var i = 0; i < keysArr.length; i += spacing) {
        key = keysArr[parseInt(i)];
        // if( i > 500)
        //     break;

        var tri = retVal.get(key.value);
        var tri1 = tri.referenceTriangle;
        var tri2 = tri.interactiveTriangle;
        //tri2 = applyTransformationMatrixToAllKeypointsObjects(tri2, trans);
        ctx.beginPath();

        var pt1 =  getCenterPointOfPoly(tri1);
        keypoints1.push({x: pt1[0], y: pt1[1]});
        var pt2 =  getCenterPointOfPoly(tri2);
        keypoints2.push({x: pt2[0]+10, y: pt2[1]+10});
        addToX(pt1, 310);
        addToY(pt1, 10);
        drawPolygonPath(ctx, [{x: pt1[0]+310, y: pt1[1]+10}, {x: pt2[0]+10, y: pt2[1]+10}]);
        ctx.stroke();
    }

    //var keypoints1 = g_globalState.interactiveCanvasState.layers[0].keypoints;
    keypoints1 = addToX2(keypoints1, 0);
    var strokeColour = ORANGE_COLOUR;
    ctx.strokeStyle = 'rgba(' + strokeColour[0] + ', ' + strokeColour[1] + ' ,' + strokeColour[2] + ', .6)';

    // drawKeypoints(ctx, keypoints1);
    // keypoints2 = applyTransformationMatrixToAllKeypointsObjects(keypoints2, trans);
    var imageOutline = g_globalState.referenceCanvasState.layers[0].nonTransformedImageOutline;
    imageOutline = applyTransformationToImageOutline(imageOutline, trans);
//        keypoints2 = filterKeypointsOutsidePolygon(keypoints2, imageOutline);
//        keypoints2 = filterKeypointsOutsidePolygon(keypoints2, buildRect(280, 280));
       drawKeypoints(ctx, keypoints2);


    sendImage();

}

function sendImage() {
    var canvas = document.getElementById('bigCanvas'),
        ctx = canvas.getContext('2d');

    var image1 = canvas.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
//
    var regex = /^data:.+\/(.+);base64,(.*)$/;
    var matches;
    matches = image1.match(regex);
    var data1 = matches[2];

    var info = {
        'image1': {
            'imageData': data1,
            'frameNumber': g_frame
        }
    };

    $.ajax({
        url: 'http://127.0.0.1/runTestWithJsonData',
        type: 'POST',
        data: JSON.stringify(info),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function (msg) {
            console.log(msg);
        },
        error: function (msg) {
            console.log(msg);
        }
    });
}


var currentAnimation = 0;
var prevAnimationsFrameCount = 0;
function doAnimations(frame) {
    g_frame = frame;//HACK
    var isDone = false;
    switch(currentAnimation) {
        case 0:
            isDone = animation1(frame);
            break;
        case 1:
            isDone = animation2(frame-prevAnimationsFrameCount);
            break;
        case 2:
            isDone = animation3(frame-prevAnimationsFrameCount);
            break;
        case 3:
            isDone = animation4(frame-prevAnimationsFrameCount);
            break;
        case 4:
            isDone = animation5(frame-prevAnimationsFrameCount);
            break;
        case 5:
            isDone = animation6(frame-prevAnimationsFrameCount);
            break;
        case 6:
            isDone = animation7(frame-prevAnimationsFrameCount);
            break;
        default:
            return true;
    }

    if(isDone){
        g_globalState.forceTempAnimations = true;
        g_globalState.activeCanvas.activeLayer = g_globalState.interactiveCanvasState.layers[0];
        animationStartTime = new Date();
        g_globalState.transformationMatBeforeTemporaryTransformations = g_globalState.activeCanvas.activeLayer.appliedTransformations;
        animationStartMatrix = g_globalState.transformationMatBeforeTemporaryTransformations;
        prevAnimationsFrameCount = frame;
        currentAnimation++;
    }
}

//returns true when finished
function computeFrames(frame){
    if (doAnimations(frame)) {
        return
    }

    let nextFrame = frame + 1;
    window.requestAnimationFrame(function () {
        computeFrames(nextFrame);
    });
}

function startAnimation() {

    reset();
    g_drawingOptions.drawImageOutline = false;
    g_drawingOptions.drawInteractiveCanvasUiLayer = true;//false;

    g_globalState.activeCanvas = g_globalState.referenceCanvasState;

//        g_globalState.activeCanvas.activeLayer = g_globalState.referenceCanvasState.layers[0];
//        g_globalState.transformationMatBeforeTemporaryTransformations = g_globalState.activeCanvas.activeLayer.appliedTransformations;
////        g_globalState.temporaryAppliedTransformations.uniformScale = 0.846153847;
//        g_globalState.temporaryAppliedTransformations.translate = {
//            x: -440,
//            y: 0
//        };
////        g_globalState.temporaryAppliedTransformations.rotation = 90;
//        applyTemporaryTransformationsToActiveLayer();
//        wipeTemporaryAppliedTransformations();


    g_globalState.activeCanvas.activeLayer = g_globalState.referenceCanvasState.layers[0];
    g_globalState.transformationMatBeforeTemporaryTransformations = g_globalState.activeCanvas.activeLayer.appliedTransformations;
    applyTemporaryTransformationsToActiveLayer();
    wipeTemporaryAppliedTransformations();

    draw();
    animationStartTime = new Date();
    g_globalState.transformationMatBeforeTemporaryTransformations = g_globalState.activeCanvas.activeLayer.appliedTransformations;
    animationStartMatrix = g_globalState.transformationMatBeforeTemporaryTransformations;

    computeFrames(1)
}

