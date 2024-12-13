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

console.log("Llegamos a flowsch 2");

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

const flowSchedule2 = addKeyword(EVENTS.ACTION).addAction(async (_, { gotoFlow, extensions, state, flowDynamic, endFlow }) => {
    console.log("Dentro de flowsch 2");
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

        const MINUTES_INCREMENT = 15;
        const dateTwo = addMinutes(desiredDate, MINUTES_INCREMENT);
                    
            const formattedDateFrom = format(dateTwo, 'hh:mm a');
            const formattedDateTo = format(addMinutes(dateTwo, +DURATION_MEET), 'hh:mm a');
            console.log('Estamos en m2');
            const m2 = `Lo siento, la hora seleccionada no está disponible. ¿Te parece bien agendar de ${formattedDateFrom} a ${formattedDateTo} el día ${format(desiredDate, 'dd/MM/yyyy')}? *si*`;    
            await flowDynamic(m2);
            await handleHistory({ content: m2, role: 'assistant' }, state);
            await state.update({ desiredDate })
            
}).addAction({ capture: true }, async ({ body }, { gotoFlow, flowDynamic, state }) => {

    if (body.toLowerCase().includes('si')) return gotoFlow(flowConfirmDos)
    if (body.toLowerCase().includes('sí')) return gotoFlow(flowConfirmDos)
    if (body.toLowerCase().includes('ok')) return gotoFlow(flowConfirmDos)

    await flowDynamic('¿Alguna otra fecha y hora?')
    await state.update({ desiredDate: null })
})

export { flowSchedule2 }