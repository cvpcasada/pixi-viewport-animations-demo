import arcToBezier from "svg-arc-to-cubic-bezier";
import { getSvgPath, type FigmaSquircleParams } from "figma-squircle";
import { parsePath } from "path-data-parser";
import { Graphics } from "pixi.js";

export function drawSquircle(graphics: Graphics, config: FigmaSquircleParams) {
  let x = 0;
  let y = 0;

  const commands = parsePath(getSvgPath(config));

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];

    switch (command.key) {
      case "M": {
        graphics.moveTo((x = command.data[0]), (y = command.data[1]));
        break;
      }
      case "L": {
        graphics.lineTo((x = command.data[0]), (y = command.data[1]));
        break;
      }

      // c (x1 y1 x2 y2 x y)
      case "c": {
        const currX = x;
        const currY = y;

        graphics.bezierCurveTo(
          currX + command.data[0],
          currY + command.data[1],
          currX + command.data[2],
          currY + command.data[3],
          (x += command.data[4]),
          (y += command.data[5])
        );
        break;
      }

      // The arc and arcTo commands are incompatible
      // with SVG (mostly because elliptical arcs)
      // so we normalize arcs from SVG into bezier curves
      case "a": {
        // a (rx ry angle large-arc-flag sweep-flag dx dy)+
        for (let c of arcToBezier({
          px: x,
          py: y,
          cx: (x += command.data[5]),
          cy: (y += command.data[6]),
          rx: command.data[0],
          ry: command.data[1],
          xAxisRotation: command.data[2],
          largeArcFlag: command.data[3] as 0 | 1,
          sweepFlag: command.data[4] as 0 | 1,
        })) {
          graphics.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        }

        break;
      }

      case "Z": {
        graphics.closePath();
        break;
      }

      default: {
        break;
      }
    }
  }

  return graphics;
}
