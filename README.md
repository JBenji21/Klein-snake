# Klein-snake
A game of snake embedded in a Klein bottle topology (with optional pychedelic projective plane variant too).
A normal game of snake occurs within a rectangle with walls at the edges.
Some remove the walls and connect the opposing sides together with a kind of edge portal, forming a torus geometry.
<img width="300" height="212" alt="image" src="https://github.com/user-attachments/assets/98c3dc51-185d-49b0-bc3e-fbe165e13653" />

In Klein-snake, the edges are connected, but the top and bottom edges are connected with a "twist" (like a mobius strip), while the left and right edges are connected normally (like a cylinder). Combining these produces a Klein bottle (https://en.wikipedia.org/wiki/Klein_bottle)!
<img width="250" height="480" alt="image" src="https://github.com/user-attachments/assets/f6a75c9e-6ffe-44c7-96ab-f9102d0def7e" />

The snake's head is fixed relative to the camera, so that you experience the world shifting around you as you navigate the Klein-bottle's surface.

There is also a projective plane mode, where the edge portals on both the top and sides are "twisted", giving the even more mind-bending geometry of the projective plane (https://en.wikipedia.org/wiki/Projective_plane).
<img width="305" height="165" alt="image" src="https://github.com/user-attachments/assets/9c059de4-a257-4a08-86fe-e6c3d188fd88" />
In this mode, segments of the snake will sometimes appear to get cut off from the rest, or to be portalling mid-screen. I'm working on another version where this won't happen, but for now it's just a result of the portal setup, and actually makes for really fun gameplay.
