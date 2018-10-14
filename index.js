#!/usr/bin/env node

const fs = require('fs');
const _ = require('lodash');
const argv = process.argv.slice(2);

const topo = JSON.parse(fs.readFileSync(argv.length > 0 ? argv[0] : '/dev/stdin'));

if (topo.type !== 'Topology') {
    console.log('Input file not valid TopoJSON')
    system.exit(1);
}

var way_counter = 0;
var node_counter = 0;
const arcToWay = {};
const nodes = {};

process.stdout.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
process.stdout.write(`<osm version="0.6" generator="topo2osm">\n`);
for (var i = 0; i < topo.arcs.length; i++) {
    const arc = topo.arcs[i];

    var way_nodes = [];

    for (var j = 0; j < arc.length; j++) {
        const coord = arc[j];
        node_counter--;

        let node_id = node_counter;
        if (coord.join(',') in nodes) {
            // node existing reuse id
            node_id = nodes[coord.join(',')];
        } else {
            nodes[coord.join(',')] = node_id;
        }

        process.stdout.write(`  <node id="${node_id}" visible="true" lat="${coord[1]}" lon="${coord[0]}" />\n`);
        way_nodes.push(node_id);
    }

    // fixme ensure we never create a one node way

    const chunks = _.chunk(way_nodes, 2000);
    chunks.forEach(function (way_nodes_chunk, index) {
        way_counter--;
        if (!arcToWay[i]) {
            arcToWay[i] = [];
        }
        arcToWay[i].push(way_counter);

        process.stdout.write(`  <way id="${way_counter}" visible="true">\n`);
        for (var k = 0; k < way_nodes_chunk.length; k++) {
            process.stdout.write(`    <nd ref="${way_nodes_chunk[k]}"/>\n`);
        }

        // join this chunk to the first node of the next chunk if there is a next chunk
        if (chunks.length > 1 && index < chunks.length - 1) {
            process.stdout.write(`    <nd ref="${chunks[index + 1][0]}"/>\n`);
        }
        process.stdout.write(`  </way>\n`);
    });
}

var relation_counter = 0;
Object.entries(topo.objects).forEach(([key, value]) => {
    for (var i = 0; i < value.geometries.length; i++) {
        const g = value.geometries[i];
        relation_counter--;

        process.stdout.write(`  <relation id="${relation_counter}" visible="true">\n`);

        if (g.type === 'Polygon') {
            g.arcs.forEach((ring, ring_index) => {
                ring.forEach((arc) => {
                    const role = ring_index === 0 ? 'outer' : 'inner';
                    if (arc < 0) {
                        arc = ~arc;
                    }
                    arcToWay[arc].forEach((ref) => {
                        process.stdout.write(`    <member type="way" ref="${ref}" role="${role}"/>\n`);
                    });
                });
            });
        } else if (g.type === 'MultiPolygon') {
            g.arcs.forEach((polygon) => {
                polygon.forEach((ring, ring_index) => {
                    ring.forEach((arc) => {
                        const role = ring_index === 0 ? 'outer' : 'inner';
                        if (arc < 0) {
                            arc = ~arc;
                        }
                        arcToWay[arc].forEach((ref) => {
                            process.stdout.write(`    <member type="way" ref="${ref}" role="${role}"/>\n`);
                        });
                    });
                });
            });
        }

        Object.entries(g.properties).forEach(([k, v]) => {
            process.stdout.write(`    <tag k="${k}" v="${v}"/>\n`);
        })
        process.stdout.write(`  </relation>\n`);
    }
});

process.stdout.write(`</osm>\n`);
