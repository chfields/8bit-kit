// Each kind of object is in a group, and a moving object only collides with the
// groups in its mask. Groups are bits, so masks combine them. Each game defines its own
// masks and any extra groups. 16 is left free, because one game uses it for barriers.
export const CollisionGroup = {
    PLAYER: 1,
    ALIEN: 2,
    PLAYER_BULLET: 4,
    ALIEN_BULLET: 8,
    ROOM: 32,
    BUTTON: 64,
};
