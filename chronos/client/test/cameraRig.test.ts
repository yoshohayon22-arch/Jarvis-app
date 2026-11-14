import { describe, expect, it } from "vitest";
import { CAMERA_TUNING, CameraRig } from "../src/render/cameraRig";

describe("CameraRig", () => {
  it("sits behind the target at the default distance", () => {
    const rig = new CameraRig();
    rig.pitch = 0;
    rig.update({ x: 0, y: 0, z: 0 }, 1 / 60, []);
    expect(rig.position.z).toBeCloseTo(CAMERA_TUNING.defaultDistance, 1);
    expect(rig.position.y).toBeCloseTo(CAMERA_TUNING.pivotHeight, 3);
  });

  it("gives camera-relative movement axes", () => {
    const rig = new CameraRig();
    const b = rig.basis();
    expect(b.fx).toBeCloseTo(0);
    expect(b.fz).toBeCloseTo(-1); // forward = north when camera is south
    expect(b.rx).toBeCloseTo(1); // right = east
  });

  it("moves in front of a wall between the player and the camera", () => {
    const rig = new CameraRig();
    rig.pitch = 0;
    const wall = { minX: -5, maxX: 5, minZ: 2, maxZ: 3, height: 10 };
    for (let i = 0; i < 30; i++) rig.update({ x: 0, y: 0, z: 0 }, 1 / 60, [wall]);
    expect(rig.position.z).toBeLessThan(2);
  });

  it("clamps pitch and zoom", () => {
    const rig = new CameraRig();
    rig.look(0, 1e6);
    expect(rig.pitch).toBe(CAMERA_TUNING.maxPitch);
    rig.zoom(1e6);
    expect(rig.desiredDistance).toBe(CAMERA_TUNING.maxDistance);
  });
});
