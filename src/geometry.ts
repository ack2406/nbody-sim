// generates a circle with a center at (0, 0)
// uses triangle fan (center + arcs)
export function generateCircleData(segments: number) {
  const vertexData: number[] = [];
  const indexData: number[] = [];

  // push circle center into the vertex array
  vertexData.push(0, 0);

  // calculate positions on the circle circumference
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    vertexData.push(x, y);
  }

  // build index array for triangle fan
  for (let i = 1; i < segments; i++) {
    indexData.push(0, i, i + 1);
  }
  // close the circle
  indexData.push(0, segments, 1);

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint32Array(indexData),
    numVertices: indexData.length,
  };
}
