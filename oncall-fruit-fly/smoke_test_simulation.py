import sys
import importlib.metadata
import numpy as np
import mujoco as mj

print("==========================================")
print("FlyGym 2.x Smoke Test & Model Verification")
print("==========================================")

version = importlib.metadata.version("flygym")
print(f"FlyGym package version: {version}")
print(f"MuJoCo version: {mj.__version__}")

from flygym.anatomy import (
    Skeleton,
    JointPreset,
    AxisOrder,
    ActuatedDOFPreset,
    ContactBodiesPreset,
)
from flygym.compose import NeuroMechFly, ActuatorType, FlatGroundWorld, KinematicPosePreset
from flygym.rendering import Renderer
from flygym.utils.math import Rotation3D
import flygym_demo

print("\n1. Composing NeuroMechFly model...")
fly = NeuroMechFly()

skeleton = Skeleton(
    joint_preset=JointPreset.ALL_BIOLOGICAL,
    axis_order=AxisOrder.YAW_PITCH_ROLL
)
fly.add_joints(skeleton, KinematicPosePreset.NEUTRAL)

actuated_dofs_list = skeleton.get_actuated_dofs_from_preset(ActuatedDOFPreset.LEGS_ACTIVE_ONLY)
fly.add_actuators(
    actuated_dofs_list,
    ActuatorType.POSITION,
    neutral_input=KinematicPosePreset.NEUTRAL,
    kp=50.0,
    ctrlrange=(-3.14, 3.14),
)

fly.add_joint_sites(JointPreset.LEGS_ONLY.to_joint_list())
fly.colorize()
fly.add_tracking_camera(name="trackingcam")
print(f"NeuroMechFly model composed successfully: {len(actuated_dofs_list)} actuated DOFs added.")

print("\n2. Composing FlatGroundWorld...")
world = FlatGroundWorld()
world.add_fly(
    fly,
    (0, 0, 0.8),
    Rotation3D("quat", (1, 0, 0, 0)),
    bodysegs_with_ground_contact=ContactBodiesPreset.LEGS_THORAX_ABDOMEN_HEAD,
)

print("\n3. Compiling MuJoCo physics model...")
mj_model, mj_data = world.compile()
print(f"MuJoCo model successfully compiled!")
print(f" - Number of bodies (nbody): {mj_model.nbody}")
print(f" - Number of joints (njnt): {mj_model.njnt}")
print(f" - Number of DOFs (nv): {mj_model.nv}")
print(f" - Number of actuators (nu): {mj_model.nu}")
print(f" - Number of geometries (ngeom): {mj_model.ngeom}")
print(f" - Timestep: {mj_model.opt.timestep} s")

print("\n4. Stepping physics simulation for 200 steps (0.02s of simulation time)...")
init_z = mj_data.qpos[2]
print(f"Initial z-position of fly thorax: {init_z:.4f} mm")

for step in range(200):
    mj.mj_step(mj_model, mj_data)
    if np.isnan(mj_data.qpos).any() or np.isnan(mj_data.qvel).any():
        raise RuntimeError(f"NaN detected at physics step {step}!")

final_z = mj_data.qpos[2]
print(f"Physics simulation stepped successfully: 200 steps.")
print(f"Final z-position of fly thorax: {final_z:.4f} mm")
print(f"Physics state is valid and stable (no NaNs detected).")

print("\n5. Testing offscreen camera rendering with Renderer...")
from PIL import Image
renderer = Renderer(
    mj_model,
    cameras="trackingcam",
    camera_res=(480, 640),
    render_rgb=True,
    buffer_frames=True,
)
with renderer:
    renderer.render_as_needed(mj_data)
    frames = renderer.frames["trackingcam"]
    print(f"Successfully rendered frame: shape = {frames[0].shape}, dtype = {frames[0].dtype}")
    
    img = Image.fromarray(frames[0])
    img_path = "smoke_test_render.png"
    img.save(img_path)
    print(f"Rendered frame saved to {img_path}")

print("\n==========================================")
print("ALL SMOKE TESTS PASSED SUCCESSFULLY!")
print("==========================================")
