/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_format_hex.c                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

int	ft_format_hex(unsigned int n, t_fmt *fmt, int uppercase)
{
	char	*prefix;

	(void)uppercase;
	prefix = "";
	if (fmt->hash && n != 0 && fmt->spec == 'x')
		prefix = "0x";
	else if (fmt->hash && n != 0 && fmt->spec == 'X')
		prefix = "0X";
	return (ft_print_number((unsigned long)n, fmt, prefix, 16));
}
