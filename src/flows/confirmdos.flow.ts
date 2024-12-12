import { addKeyword, EVENTS } from "@builderbot/bot";
import { clearHistory } from "../utils/handleHistory";
import { addMinutes, format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { appToCalendar } from "src/services/calendar";

const DURATION_MEET = process.env.DURATION_MEET ?? 45
const TIME_ZONE = process.env.TZ
/**
 * Encargado de pedir los datos necesarios para registrar el evento en el calendario
 */
const flowConfirmDos = addKeyword(EVENTS.ACTION).addAction(async (_, { flowDynamic }) => {
    await flowDynamic('Ok, voy a pedirte unos datos para agendar')
    await flowDynamic('¿Cual es tu nombre?')
}).addAction({ capture: true }, async (ctx, { state, flowDynamic, endFlow }) => {

    if (ctx.body.toLocaleLowerCase().includes('cancelar')) {
        clearHistory(state)
        return endFlow(`¿Como puedo ayudarte?`)

    }
    await state.update({ name: ctx.body })
    await flowDynamic(`Última pregunta ¿Cual es tu email?`)
})
    .addAction({ capture: true }, async (ctx, { state, flowDynamic, fallBack }) => {

        if (!ctx.body.includes('@')) {
            return fallBack(`Debes ingresar un mail correcto`)
        }

        const dateObject = {
            name: state.get('name'),
            email: ctx.body,
            startDate: addMinutes(utcToZonedTime(state.get('desiredDate'), TIME_ZONE), 15),
            endData: addMinutes(utcToZonedTime(addMinutes(state.get('desiredDate'), +DURATION_MEET), TIME_ZONE), 15),
            phone: ctx.from
        };        

        await appToCalendar(dateObject)

        clearHistory(state)
        await flowDynamic('Listo! agendado. Si tienes alguna duda o quieres cambiar la fecha y hora de la cita, contáctanos al siguiente número de teléfono: +34 652 83 70 41. ¡Muchas gracias por agendar una cita! ¡Nos vemos pronto!')
    })

export { flowConfirmDos }