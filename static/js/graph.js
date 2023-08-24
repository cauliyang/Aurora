const walks = [];
let cy;
let previousClickedElement = null;
let previousClickedElementStyle = null;

// Get the "Change Layout" button element
const layoutSelect = document.getElementById("layoutSelect");

layoutSelect.addEventListener("change", () => {
	// Get the selected layout from the select element
	const selectedLayout = layoutSelect.value;

	if (cy === undefined) return;

	// Apply the chosen layout
	cy.layout({
		name: selectedLayout,
		animate: true, // You can adjust animation settings if needed
		fit: true,
		padding: 10,
		avoidOverlap: true,
		rankDir: "LR",
	}).run();
});

function loadGraphDataFromServer(graphData) {
	initializeGraph(graphData);
	setupGraphInteractions();
}

document
	.getElementById("uploadInput")
	.addEventListener("change", handleFileUpload);

function handleFileUpload(event) {
	const file = event.target.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = function (e) {
			const content = e.target.result;
			try {
				const jsonData = JSON.parse(content);
				console.log(jsonData);
				// Process and visualize the JSON data
				// For example: visualizeGraph(jsonData);
				loadGraphDataFromServer(jsonData);
			} catch (error) {
				console.error("Error parsing JSON:", error);
			}
		};
		reader.readAsText(file);
	}
}

document.getElementById("resetGraph").addEventListener("click", function () {
	// Reset layout to default
	resetPreviousElementStyle();
	previousClickedElement = null;
	previousClickedElementStyle = null;
	cy.elements().removeClass("highlighted");
	layoutSelect.value = "dagre";
	cy.layout({
		name: "dagre",
		animate: true,
		fit: true,
		padding: 10,
		avoidOverlap: true,
		rankDir: "LR",
	}).run();
});

document.getElementById("captureGraph").addEventListener("click", function () {
	// Get the base64 representation of the graph
	const base64Image = cy.png();

	// Create a new anchor element to enable downloading
	const downloadLink = document.createElement("a");
	downloadLink.href = base64Image;
	downloadLink.download = "graph_capture.png";

	// Trigger the download
	downloadLink.click();
});

document.addEventListener("DOMContentLoaded", function () {
	console.log("DOM Loaded");

	// Split between #cy and #walks
	Split(["#cy", "#walks"], {
		sizes: [67, 33], // This will give the cy panel 67% width initially and walks panel 33% width initially.
		minSize: [100, 100],
		gutterSize: 5,
		direction: "horizontal",
	});

	// Split between the top panels (#cy and #walks combined) and #info
	Split(["#top-container", "#info"], {
		sizes: [70, 30], // This will give the top container 70% height initially and info panel 30% height initially.
		minSize: [100, 100],
		gutterSize: 5,
		direction: "vertical",
	});
});

function initializeGraph(graphData) {
	// ... [All the code inside your fetch(jsonfile).then((graphData) => {...}) block]
	cy = cytoscape({
		container: document.getElementById("cy"),
		layout: {
			name: "dagre",
			fit: true,
			padding: 10,
			avoidOverlap: true,
			rankDir: "LR",
		},
		style: [
			{
				selector: ".highlighted",
				style: {
					"border-width": "0px",
					"border-color": "#FF5733",
				},
			},
			{
				selector: "edge.highlighted",
				style: {
					width: "4px",
					"line-color": "#FF5733",
					"target-arrow-color": "#FF5733",
				},
			},
			{
				selector: "node",
				style: {
					label: "data(name)",
					"background-color": "#666",
				},
			},
			{
				selector: "node[source-node]",
				style: {
					"background-color": "#31a354",
				},
			},
			{
				selector: "edge",
				style: {
					width: "data(weight)",
					label: "data(weight)",
					"text-rotation": "autorotate",
					"curve-style": "bezier",
					"target-arrow-shape": "triangle",
				},
			},
		],

		// initial viewport state:
		zoom: 1,
		pan: { x: 0, y: 0 },

		// interaction options:
		minZoom: 0.1,
		maxZoom: 3,
		zoomingEnabled: true,
		userZoomingEnabled: true,
		panningEnabled: true,
		userPanningEnabled: true,
		boxSelectionEnabled: false,
		selectionType: "single",
		touchTapThreshold: 8,
		desktopTapThreshold: 4,
		autolock: false,
		autoungrabify: false,
		elements: graphData,
	});

	cy.nodes().forEach((node) => {
		if (
			node.outgoers().edges().length > 0 &&
			node.incomers().edges().length === 0
		) {
			node.data("source-node", true);
		}
	});

	walks.length = 0;
	const sourceNodes = cy.nodes().filter((node) => node.indegree() === 0);
	const sinkNodes = cy.nodes().filter((node) => node.outdegree() === 0);

	sourceNodes.forEach((sourceNode) => {
		dfs(sourceNode, [], sinkNodes);
	});
}

function setupGraphInteractions() {
	// ... [Your cy.on("tap", ...), displayWalks(), setupClickEvent(), and Split functions calls]
	cy.on("tap", function (evt) {
		if (evt.target === cy) {
			resetPreviousElementStyle();
			previousClickedElement = null;
			previousClickedElementStyle = null;

			cy.elements().removeClass("highlighted");
		}
	});

	displayWalks();
	setupClickEvent();
	createTooltip();
}

function displayWalks() {
	const walksContainer = document.getElementById("walks");

	// Clear previous walks display
	walksContainer.innerHTML = "<h3>Graph Walks:</h3>";

	walks.forEach((walk, index) => {
		const walkDiv = document.createElement("div");
		walkDiv.textContent = `Walk ${index + 1}: ${walk
			.map((node) => node.id())
			.join(" -> ")}`;

		walkDiv.title = "Click to highlight this walk in the graph"; // Tooltip

		// Add a click event to each walk element
		walkDiv.addEventListener("click", function () {
			highlightWalk(walk);
		});

		walksContainer.appendChild(walkDiv);
	});
}

function highlightWalk(walk) {
	// Reset any previously highlighted nodes or edges
	cy.elements().removeClass("highlighted");
	for (let i = 0; i < walk.length; i++) {
		// Highlight every node in the walk
		walk[i].addClass("highlighted");

		// If it's not the last node in the walk, highlight the edge to the next node
		if (i < walk.length - 1) {
			const currentNode = walk[i];
			const nextNode = walk[i + 1];
			const connectingEdge = currentNode.edgesTo(nextNode);
			connectingEdge.addClass("highlighted");
		}
	}
}
function dfs(node, currentPath, sinkNodes) {
	currentPath.push(node);

	if (sinkNodes.includes(node)) {
		walks.push([...currentPath]); // Found a path
	} else {
		const neighbors = node.outgoers().nodes();
		neighbors.forEach((neighbor) => {
			dfs(neighbor, currentPath, sinkNodes);
		});
	}

	currentPath.pop(); // backtrack
}

function resetPreviousElementStyle() {
	if (previousClickedElement) {
		if (previousClickedElement.isNode()) {
			previousClickedElement.style(previousClickedElementStyle);
		} else if (previousClickedElement.isEdge()) {
		}
	}
}

function setupClickEvent() {
	cy.on("tap", "node, edge", function (evt) {
		resetPreviousElementStyle();
		const element = evt.target;

		const infoContainer = document.getElementById("info");
		let infoHtml = "";

		if (element.isNode()) {
			const indegree = element.indegree();
			const outdegree = element.outdegree();

			infoHtml = `
                    <h4>Node Information:</h4>
                    <p><strong>ID:</strong> ${element.id()}</p>
                    <p><strong>Data:</strong> ${JSON.stringify(element.data())}</p>
                `;

			infoHtml += `In-degree: ${indegree}<br>`;
			infoHtml += `Out-degree: ${outdegree}<br>`;

			previousClickedElementStyle = element.style();
			// Highlight the clicked node
			element.style({
				"background-color": "#8dd3c7",
				"border-width": "0px",
				// "border-color": "#8dd3c7", // get current color
			});

			element.addClass("highlighted");
		} else if (element.isEdge()) {
			infoHtml = `
                    <h4>Edge Information:</h4>
                    <p><strong>Source:</strong> ${element.source().id()}</p>
                    <p><strong>Target:</strong> ${element.target().id()}</p>
                    <p><strong>Data:</strong> ${JSON.stringify(element.data())}</p>
                `;
		}

		// Update the previously clicked item
		previousClickedElement = element;
		infoContainer.innerHTML = infoHtml;
	});
}
