import trimesh
import numpy as np

def create_dart_drone():
    # 1. Create the Main Body (The "Dart" Core)
    # A cone representing the aerodynamic kinetic penetrator
    body = trimesh.creation.cone(radius=0.2, height=1.5)
    
    # 2. Create the Stabilizer Fins (Tier 3 Graphene Fins)
    # Using a box as a base and transforming it into a thin triangle
    fin_shape = trimesh.creation.box(extents=[0.5, 0.02, 0.4])
    
    fins = []
    for i in range(4):
        angle = np.pi / 2 * i
        # Rotate and translate fins to the base of the cone
        rotation = trimesh.transformations.rotation_matrix(angle, [0, 0, 1])
        translation = trimesh.transformations.translation_matrix([0.2, 0, -0.5])
        matrix = trimesh.transformations.concatenate_matrices(rotation, translation)
        
        fin_instance = fin_shape.copy()
        fin_instance.apply_transform(matrix)
        fins.append(fin_instance)

    # 3. Create the Thruster Port
    thruster = trimesh.creation.cylinder(radius=0.1, height=0.1)
    thruster.apply_translation([0, 0, -0.75])

    # 4. Combine all meshes
    dart_mesh = trimesh.util.concatenate([body] + fins + [thruster])

    # 5. Apply Material Colors (Visual Metadata)
    # Dark Grey for Graphene/Steel, Glowing Blue for the Thruster
    dart_mesh.visual.face_colors = [100, 100, 100, 255] # Grey
    
    return dart_mesh

# Generate and Export
drone = create_dart_drone()
drone.export('/tmp/expendable_dart_drone.glb')
print("Model exported as expendable_dart_drone.glb")
