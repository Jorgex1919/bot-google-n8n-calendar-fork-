import { addKeyword, EVENTS } from "@builderbot/bot";
import AIClass from "../services/ai";
import { getHistoryParse, handleHistory } from "../utils/handleHistory";
import { generateTimer } from "../utils/generateTimer";
import { getCurrentCalendar } from "../services/calendar";
import { getFullCurrentDate } from "src/utils/currentDate";
import { flowConfirm } from "./confirm.flow";
import { addMinutes, isWithinInterval, format, parse } from "date-fns";
import { flowConfirmDos } from "./confirmdos.flow";

const DURATION_MEET = process.env.DURATION_MEET ?? 45

const PROMPT_FILTER_DATE = `
### Contexto
Eres un asistente de inteligencia artificial. Tu propósito es determinar la fecha y hora que el cliente quiere, en el formato yyyy/MM/dd HH:mm:ss.

### Fecha y Hora Actual:
{CURRENT_DAY}

### Registro de Conversación:
{HISTORY}

Asistente: "{respuesta en formato (yyyy/MM/dd HH:mm:ss)}"
`;

const generatePromptFilter = (history: string) => {
    const nowDate = getFullCurrentDate();
    const mainPrompt = PROMPT_FILTER_DATE
        .replace('{HISTORY}', history)
        .replace('{CURRENT_DAY}', nowDate);

    return mainPrompt;
}

const flowSchedule = addKeyword(EVENTS.ACTION).addAction(async (_, { gotoFlow, extensions, state, flowDynamic, endFlow }) => {
    await flowDynamic('Dame un momento para consultar la agenda...');
    const ai = extensions.ai as AIClass;
    const history = getHistoryParse(state);
    const list = await getCurrentCalendar()

    const listParse = list
        .map(({ start, end }) => ({ fromDate: new Date(start), toDate: new Date(end) }));

    console.log({ listParse })

    const promptFilter = generatePromptFilter(history);

    const { date } = await ai.desiredDateFn([
        {
            role: 'system',
            content: promptFilter
        }
    ]);

    const desiredDate = parse(date, 'yyyy/MM/dd HH:mm:ss', new Date());

    const isDateAvailable = listParse.every(({ fromDate, toDate }) => !isWithinInterval(desiredDate, { start: fromDate, end: toDate }));
    console.log(desiredDate);
    console.log(isDateAvailable);

    if (!isDateAvailable) {
        const MINUTES_INCREMENT = 15;
        const dateTwo = addMinutes(desiredDate, MINUTES_INCREMENT);
        const isDateAvailable2 = listParse.every(({ fromDate, toDate }) => !isWithinInterval(dateTwo, { start: fromDate, end: toDate }));
        console.log(dateTwo);
        console.log(isDateAvailable2);
        
        if (!isDateAvailable2) {
            console.log('Fecha no disponible, revisando incrementos...');
            const m = 'Lo siento, esa hora ya está reservada. ¿Alguna otra fecha y hora?';
            await flowDynamic(m);
            await handleHistory({ content: m, role: 'assistant' }, state);
            return endFlow()
        } else{            
            const formattedDateFrom = format(dateTwo, 'hh:mm a');
            const formattedDateTo = format(addMinutes(dateTwo, +DURATION_MEET), 'hh:mm a');
            const m2 = `Lo siento, la hora seleccionada no está disponible. ¿Te parece bien agendar de ${formattedDateFrom} a ${formattedDateTo} el día ${format(desiredDate, 'dd/MM/yyyy')}? *si*`;    
            await flowDynamic(m2);
            await handleHistory({ content: m2, role: 'assistant' }, state);
            await state.update({ desiredDate })
            
            const flowConfirmDos = addKeyword(EVENTS.ACTION).addAction(async (_, { flowDynamic, state }) => {
                await flowDynamic(m2)
            }).addAction({ capture: true }, async ({ body }, { gotoFlow, flowDynamic, state }) => {

                console.log('Redirigiendo a flowConfirmDos...');
                if (body.toLowerCase().includes('si')) return gotoFlow(flowConfirmDos)
                if (body.toLowerCase().includes('sí')) return gotoFlow(flowConfirmDos)
                if (body.toLowerCase().includes('ok')) return gotoFlow(flowConfirmDos)
            
                await flowDynamic('¿Alguna otra fecha y hora?')
                await state.update({ desiredDate: null })
            })
        }
    }

    const formattedDateFrom = format(desiredDate, 'hh:mm a');
    const formattedDateTo = format(addMinutes(desiredDate, +DURATION_MEET), 'hh:mm a');
    const message = `¡Perfecto! Tenemos disponibilidad de ${formattedDateFrom} a ${formattedDateTo} el día ${format(desiredDate, 'dd/MM/yyyy')}. ¿Confirmo tu reserva? *si*`;
    await handleHistory({ content: message, role: 'assistant' }, state);
    await state.update({ desiredDate })

    const chunks = message.split(/(?<!\d)\.\s+/g);
    for (const chunk of chunks) {
        await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }]);
    }
            await handleHistory({ content: message, role: 'assistant' }, state);
}).addAction({ capture: true }, async ({ body }, { gotoFlow, flowDynamic, state }) => {

    if (body.toLowerCase().includes('si')) return gotoFlow(flowConfirm)
    if (body.toLowerCase().includes('sí')) return gotoFlow(flowConfirm)
    if (body.toLowerCase().includes('ok')) return gotoFlow(flowConfirm)

    await flowDynamic('¿Alguna otra fecha y hora?')
    await state.update({ desiredDate: null })
})

export { flowSchedule }