// optional peer dependency 타입 선언 - 런타임에 동적으로 로드됨
declare module 'openai' {
  const OpenAI: any;
  export default OpenAI;
  export const AzureOpenAI: any;
}

declare module '@anthropic-ai/sdk' {
  const Anthropic: any;
  export default Anthropic;
}
