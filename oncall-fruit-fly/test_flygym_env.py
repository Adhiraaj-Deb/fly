import sys
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")

print("Importing mujoco...")
import mujoco
print(f"MuJoCo version: {mujoco.__version__}")

print("Importing flygym...")
import flygym
print(f"FlyGym version: {flygym.__version__}")

print("Importing flygym_demo...")
import flygym_demo
print("flygym_demo successfully imported!")

from flygym.anatomy import Skeleton, JointPreset, AxisOrder, ActuatedDOFPreset, ContactBodiesPreset
from flygym.compose import Fly, ActuatorType, FlatGroundWorld, KinematicPosePreset
from flygym.utils.math import Rotation3D
print("Core anatomy and compose classes imported successfully!")
