import { z } from "zod"

const sendMessageValidator = z.object({
    body: z.object({
        chatId: z.string({ required_error: "You must give the chat ID" }),
        message: z.string().optional()
    })
})

const deleteMessage = z.object({
    params: z.object({
        id: z.string({ required_error: "You must give the id of your message to delete!" })
    }).strict()
})

const updateMessage = z.object({
    params: z.object({
        id: z.string({ required_error: "You must give the id of your message to delete!" })
    }).strict(),
    body: z.object({
        message: z.string().optional(),
    }).strict()
})

const getMessagesOfChat = z.object({
    params: z.object({
        id: z.string({ required_error: "You must give the id of your message to delete!" })
    }).strict(),
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional()
    }).strict()
})

export const MessageValidations = {
    sendMessageValidator,
    deleteMessage,
    getMessagesOfChat,
    updateMessage
}
