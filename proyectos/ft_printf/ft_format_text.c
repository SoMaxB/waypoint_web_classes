/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_format_text.c                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

static int	ft_join(int a, int b)
{
	if (a < 0 || b < 0)
		return (-1);
	return (a + b);
}

int	ft_format_char(int c, t_fmt *fmt)
{
	int		count;
	int		pad;
	char	ch;

	count = 0;
	ch = (char)c;
	pad = ft_max(fmt->width - 1, 0);
	if (!fmt->left)
		count = ft_join(count, ft_putnchar(' ', pad));
	count = ft_join(count, ft_putstrn(&ch, 1));
	if (fmt->left)
		count = ft_join(count, ft_putnchar(' ', pad));
	return (count);
}

int	ft_format_string(char *str, t_fmt *fmt)
{
	int	count;
	int	len;
	int	pad;

	if (!str)
		str = "(null)";
	len = ft_strlen(str);
	if (fmt->has_precision && fmt->precision < len)
		len = fmt->precision;
	pad = ft_max(fmt->width - len, 0);
	count = 0;
	if (!fmt->left)
		count = ft_join(count, ft_putnchar(' ', pad));
	count = ft_join(count, ft_putstrn(str, len));
	if (fmt->left)
		count = ft_join(count, ft_putnchar(' ', pad));
	return (count);
}

int	ft_format_percent(t_fmt *fmt)
{
	int		count;
	int		pad;
	char	pad_char;

	count = 0;
	pad = ft_max(fmt->width - 1, 0);
	pad_char = ' ';
	if (fmt->zero && !fmt->left)
		pad_char = '0';
	if (!fmt->left)
		count = ft_join(count, ft_putnchar(pad_char, pad));
	count = ft_join(count, ft_putstrn("%", 1));
	if (fmt->left)
		count = ft_join(count, ft_putnchar(' ', pad));
	return (count);
}
