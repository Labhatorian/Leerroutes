import * as d3 from "d3";

export class LeerrouteWorkspace extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.width = "100%";
    this.height = "100%";

    //Default values
    this.nodeRadius = 20;
    this.linkWidth = 3;
    this.linkOpacity = 0.6;
    this.linkSpacing = 2;

    if (!this.leerrouteItems) this.leerrouteItems = []; // Prevents expected error
    this.createWorkspace();

    // Add event listener for window resize
    window.addEventListener("resize", () => {
      this.simulation.stop();
      if (this.groupPositions) this.updateNodePositions(this.groupPositions);
      this.simulation.restart();
    });
  }

  static get observedAttributes() {
    return ["node-radius", "link-width", "link-opacity", "link-spacing"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "node-radius":
        this.nodeRadius = parseFloat(newValue);
        break;
      case "link-width":
        this.linkWidth = parseFloat(newValue);
        break;
      case "link-opacity":
        this.linkOpacity = parseFloat(newValue);
        break;
      case "link-spacing":
        this.linkSpacing = parseFloat(newValue);
        break;
      case "node-color":
        this.nodeColor = JSON.parse(newValue); // Expecting a JSON array for colors
        break;
    }
  }

  setLeerrouteItems(leerrouteItems) {
    console.log("Received leerrouteItems:", leerrouteItems);
    this.leerrouteItems = leerrouteItems;
    this.groupPositions = {};

    // Add a parents array to each item for metrolines
    this.leerrouteItems.forEach((item) => {
      item.children.forEach((childID) => {
        const childItem = this.leerrouteItems.find(
          (childItem) => childItem.id === childID,
        );
        if (childItem) {
          if (!childItem.parents) {
            childItem.parents = [];
          }
          childItem.parents.push(item.id);
        }
      });

      if (!this.groupPositions[item.groupPosition]) {
        this.groupPositions[item.groupPosition] = {};
      }
    });

    console.log("Parents added: ", this.leerrouteItems);

    //Create links backwards starting with items that have no children
    const noChildrenItems = this.leerrouteItems.filter((item) => {
      return !item.children || item.children.length === 0;
    });

    //Make sure every item has a link array
    this.leerrouteItems.forEach((item) => {
      if (!item.links) {
        item.links = [];
      }
    });

    const createRecursiveLinks = function (
      item,
      scopedLeerrouteItems,
      colour,
      constraints = [],
    ) {
      if (!item.parents || item.parents.length === 0) return; // If no parent, stop recursion

      item.parents.forEach((parent) => {
        // Check if current item is listed in the constraints of the parent item
        if (
          constraints.some((constraint) => {
            if (typeof constraint === "string") {
              return constraint === parent;
            } else if (typeof constraint === "object") {
              return constraint.from === item.id && constraint.to === parent;
            }
          })
        ) {
          return;
        }

        const parentInstance = scopedLeerrouteItems.find(
          (findParent) => findParent.id === parent,
        );
        if (!parent) return;

        // Create the link
        const link = {
          source: parentInstance.id,
          target: item.id,
          value: 20,
          colour: colour,
        };

        // Add link to the parent item
        if (!parentInstance.links) {
          parentInstance.links = [];
        }

        // Check if the link already exists
        const linkExists = parentInstance.links.some(
          (existingLink) =>
            existingLink.source === link.source &&
            existingLink.target === link.target &&
            existingLink.value === link.value &&
            existingLink.colour === link.colour,
        );

        if (!linkExists) {
          parentInstance.links.push(link);
        }

        // Recursively create links for the parent
        createRecursiveLinks(parentInstance, scopedLeerrouteItems, colour, [
          ...constraints,
          ...parentInstance.constraints,
        ]);
      });
    };

    const predefinedColors = [
      "green",
      "red",
      "purple",
      "brown",
      "pink",
      "gray",
      "gold",
    ];
    let colorIndex = 0;
    noChildrenItems.forEach((item) => {
      createRecursiveLinks(
        item,
        this.leerrouteItems,
        predefinedColors[colorIndex],
        item.constraints,
      );
      colorIndex = (colorIndex + 1) % predefinedColors.length; // with cycle back just in case
    });

    console.log("Links added: ", this.leerrouteItems);

    // Calculate positions for each node based on group and position, fx and fy are fixed
    this.updateNodePositions(this.groupPositions);

    this.updateWorkspace();
  }

  updateNodePositions(groupPositions) {
    const containerWidth = this.container.clientWidth - this.nodeRadius * 2; // Circle width padding
    const containerHeight = this.container.clientHeight;

    // Calculate scale factors for x and y positions
    const xScale = d3
      .scaleLinear()
      .domain([0, Object.keys(groupPositions).length - 1])
      .range([0, containerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([0, containerHeight])
      .range([0, containerHeight]);

    // Function to calculate vertical spacing based on the number of items in each group
    const calculateVerticalSpacing = (groupPosition) => {
      const itemCount = this.leerrouteItems.filter(
        (item) => item.groupPosition === groupPosition,
      ).length;
      const verticalSpacing = containerHeight / itemCount;
      // Adjust vertical spacing based on the available space
      return verticalSpacing;
    };

    let index = 0;
    Object.keys(groupPositions).forEach((key) => {
      const groupPosition = groupPositions[key];
      groupPosition.index = 0;

      const itemCount = this.leerrouteItems.filter(
        (item) => item.groupPosition === key,
      ).length;

      const groupHeight = (calculateVerticalSpacing(key) * (itemCount - 1)) / 2;
      const x = xScale(index) + 20;
      const y = yScale(containerHeight / 2) - groupHeight;

      groupPosition.x = x;
      groupPosition.y = y;
      index++;
    });

    this.leerrouteItems.forEach((item) => {
      const groupPosition = groupPositions[item.groupPosition];
      if (!groupPosition.index) groupPosition.index = 0;
      if (groupPosition) {
        // Scale and set the fixed x position
        item.fx = groupPosition.x;
        // Calculate and set the dynamic y position based on group index and vertical spacing
        item.fy =
          groupPosition.y +
          groupPosition.index * calculateVerticalSpacing(item.groupPosition);
        groupPosition.index += 1;
      }
    });
  }

  createWorkspace() {
    // Create a container div for the simulation
    const container = document.createElement("div");
    container.style.width = this.width;
    container.style.height = this.height;
    this.shadowRoot.appendChild(container);
    this.container = container; // Store the container reference

    // Render the workspace content
    this.renderWorkspace();
  }

  updateWorkspace() {
    // Clear the existing content
    this.container.innerHTML = "";
    // Render the workspace content
    this.renderWorkspace();
  }

  renderWorkspace() {
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Get the width and height of the container so we can calculate center
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    // Simulation is essentially the workspace where all the nodes and links will appear
    const simulation = d3
      .forceSimulation(this.leerrouteItems)
      .force(
        "link",
        d3
          .forceLink(this.leerrouteItems.flatMap((d) => d.links))
          .id((d) => d.id),
      )
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .on("tick", ticked);

    this.simulation = simulation;

    // Append SVG to the container
    const svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height);

    // Links between nodes
    const link = svg
      .append("g")
      .attr("stroke-opacity", this.linkOpacity)
      .selectAll()
      .data(this.leerrouteItems.flatMap((d) => d.links))
      .join("line")
      .attr("stroke-width", this.linkWidth)
      .attr("stroke", (d) => d.colour);

    // Node, a LeerrouteItem
    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll()
      .data(this.leerrouteItems)
      .join("g");

    // Append circles for nodes
    node
      .append("circle")
      .attr("r", this.nodeRadius)
      .attr("fill", (d) => color(d.group));

    // Append text for labels
    node
      .append("text")
      .text((d) => d.id)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#000")
      .style("font-size", "10px");

    // Append callback function
    node.on("click", function (event, d) {
      if (d.data && d.data.link) {
        window.open(d.data.link, "_blank");
      }
    });

    // A tick from the simulation
    function ticked() {
      const radius = 17; // Fixed node radius

      link
        .attr("x1", (d) => calculateX(d.source, d.index, d.source.links.length))
        .attr("y1", (d) => calculateY(d.source, d.index, d.source.links.length))
        .attr("x2", (d) => calculateX(d.target, d.index, d.source.links.length))
        .attr("y2", (d) =>
          calculateY(d.target, d.index, d.source.links.length),
        );

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);

      function calculateX(node, index, totalLinks) {
        const angle = 2 * Math.PI * (index / totalLinks); // Spread links evenly in a circular manner
        const offsetAngle =
          (index - (totalLinks - 1) / 2) * (rhis.linkSpacing / radius);
        return node.x + radius * Math.cos(angle + offsetAngle);
      }

      function calculateY(node, index, totalLinks) {
        const angle = 2 * Math.PI * (index / totalLinks); // Spread links evenly in a circular manner
        const offsetAngle =
          (index - (totalLinks - 1) / 2) * (this.linkSpacing / radius);
        return node.y + radius * Math.sin(angle + offsetAngle);
      }
    }

    simulation.on("end", () => {
      simulation.stop();
    });
  }
}
