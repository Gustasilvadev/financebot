// Erro de regra de negócio: mensagem que deve ser exibida ao usuário.
export class ErroDeNegocio extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}
