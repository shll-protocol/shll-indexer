import { ponder } from "ponder:registry";
import { groupMember } from "../ponder.schema";

ponder.on("GroupRegistry:GroupMemberSet", async ({ event, context }) => {
    const { groupId, member, allowed } = event.args;
    await context.db.insert(groupMember).values({
        id: `${groupId}-${member}`,
        type: "generic",
        groupId: Number(groupId),
        address: member,
        allowed,
        updatedAt: event.block.timestamp,
    }).onConflictDoUpdate({
        allowed,
        updatedAt: event.block.timestamp,
    });
});
