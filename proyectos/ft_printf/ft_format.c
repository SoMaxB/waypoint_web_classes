/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_format.c                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

int	ft_format(va_list ap, t_fmt *fmt)
{
	if (fmt->spec == 'c')
		return (ft_format_char(va_arg(ap, int), fmt));
	if (fmt->spec == 's')
		return (ft_format_string(va_arg(ap, char *), fmt));
	if (fmt->spec == 'p')
		return (ft_format_pointer(va_arg(ap, void *), fmt));
	if (fmt->spec == 'd' || fmt->spec == 'i')
		return (ft_format_signed(va_arg(ap, int), fmt));
	if (fmt->spec == 'u')
		return (ft_format_unsigned(va_arg(ap, unsigned int), fmt));
	if (fmt->spec == 'x')
		return (ft_format_hex(va_arg(ap, unsigned int), fmt, 0));
	if (fmt->spec == 'X')
		return (ft_format_hex(va_arg(ap, unsigned int), fmt, 1));
	if (fmt->spec == '%')
		return (ft_format_percent(fmt));
	return (0);
}
